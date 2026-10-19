import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '@/components/ConfirmModal';
import ScreenHeader from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { changeLanguage, type Language } from '@/i18n';
import { profileService, UserProfile, UserType } from '@/services/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// La hora del chequeo diario se muestra y se elige en hora de Argentina (UTC-3); el servidor la guarda en UTC
const ARGENTINA_UTC_OFFSET_HOURS = 3;
const utcToLocal = (utcHour: number) => (utcHour - ARGENTINA_UTC_OFFSET_HOURS + 24) % 24;
const localToUtc = (localHour: number) => (localHour + ARGENTINA_UTC_OFFSET_HOURS + 24) % 24;

export default function PerfilScreen() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [confirmDisableNotifications, setConfirmDisableNotifications] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);

  const [coverageDaysInput, setCoverageDaysInput] = useState('7');
  const [expiryDaysInput, setExpiryDaysInput] = useState('7');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [alertCheckHourInput, setAlertCheckHourInput] = useState('8');
  const [userType, setUserType] = useState<UserType>('individuo');

  // Carga en los campos de edición lo que tiene guardado el perfil
  const fillForm = useCallback((p: UserProfile) => {
    setFirstName(p.firstName ?? '');
    setLastName(p.lastName ?? '');
    setUsername(p.username ?? '');
    setCoverageDaysInput(String(p.coverageDaysThreshold));
    setExpiryDaysInput(String(p.expiryDaysThreshold));
    setAlertCheckHourInput(String(Math.round(utcToLocal(p.alertCheckHour))));
    setUserType(p.userType);
  }, []);

  useFocusEffect(useCallback(() => {
    // Al volver a la pantalla se ve el perfil, no una edición que quedó a medias
    setEditing(false);
    setLoading(true);
    profileService.getProfile()
      .then((p) => {
        setProfile(p);
        fillForm(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fillForm]));

  const handleLogout = async () => {
    setConfirmLogoutVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  // Pide confirmación antes de cambiar al otro idioma
  const askToggleLanguage = () => {
    setPendingLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  const confirmLanguageChange = async () => {
    const next = pendingLanguage;
    setPendingLanguage(null);
    if (next) await changeLanguage(next);
  };

  const handleStartEdit = () => {
    if (profile) fillForm(profile);
    setEditing(true);
    setFeedback(null);
  };

  // Guarda de una vez los datos personales, el tipo de cuenta y la configuración de alertas
  const handleSave = async () => {
    setFeedback(null);
    const coverageDays = parseInt(coverageDaysInput, 10);
    const expiryDays = parseInt(expiryDaysInput, 10);
    const hour = parseInt(alertCheckHourInput, 10);
    if (isNaN(coverageDays) || coverageDays <= 0 || isNaN(expiryDays) || expiryDays <= 0 || isNaN(hour) || hour < 0 || hour > 23) {
      setFeedback({ type: 'error', msg: t('profile.invalidSettings') });
      return;
    }
    setSaving(true);
    try {
      const updated = await profileService.updateProfile(
        firstName.trim(),
        lastName.trim(),
        username.trim() || undefined,
        coverageDays,
        expiryDays,
        Math.round(localToUtc(hour)),
        userType,
      );
      setProfile(updated);
      setEditing(false);
      setFeedback({ type: 'ok', msg: t('profile.saveSuccess') });
    } catch {
      setFeedback({ type: 'error', msg: t('profile.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) fillForm(profile);
    setEditing(false);
    setFeedback(null);
  };

  useEffect(() => {
    const loadNotificationsStatus = async () => {
      try {
        const saved = await AsyncStorage.getItem('notificationsEnabled');
        if (saved !== null) {
          setNotificationsEnabled(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading notifications status:', error);
      }
    };

    loadNotificationsStatus();
  }, []);

  const handleActivateNotifications = async () => {
    try {
      if (notificationsEnabled) {
        const _ = await profileService.deactivateNotifications();
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(false));
      } else {
        const notificationsActivated = await profileService.activateNotifications();
        setNotificationsEnabled(notificationsActivated);
        await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
      }
    } catch (error) {
      console.error('Error activating notifications:', error);
    }
  };

  const initials = `${(profile?.firstName ?? '')[0] ?? ''}${(profile?.lastName ?? '')[0] ?? ''}`.toUpperCase() || '?';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScreenHeader title={t('tabs.profile')} onHomePress={() => router.navigate('/(tabs)/')} />
      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View testID="profile-avatar" style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {!editing && (
            <TouchableOpacity style={styles.editIconBtn} onPress={handleStartEdit}>
              <Ionicons name="pencil" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback */}
        {feedback && (
          <Text style={[styles.feedback, feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackError]}>
            {feedback.msg}
          </Text>
        )}

        {/* Datos personales */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.editProfile')}</Text>

          <Text style={styles.fieldLabel}>{t('profile.firstName')}</Text>
          {editing ? (
            <AppTextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('profile.firstNamePlaceholder')}
              placeholderTextColor={Colors.placeholder}
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.firstName || '—'}</Text>
          )}

          <Text style={styles.fieldLabel}>{t('profile.lastName')}</Text>
          {editing ? (
            <AppTextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('profile.lastNamePlaceholder')}
              placeholderTextColor={Colors.placeholder}
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.lastName || '—'}</Text>
          )}

          <Text style={styles.fieldLabel}>{t('profile.email')}</Text>
          <Text style={[styles.fieldValue, styles.fieldReadOnly]}>{profile?.email || '—'}</Text>

          <Text style={styles.fieldLabel}>{t('profile.username')}</Text>
          {editing ? (
            <AppTextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder={t('profile.username')}
              placeholderTextColor={Colors.placeholder}
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.fieldValue}>{profile?.username || '—'}</Text>
          )}
        </View>

        {/* Configuración: se ve completa y solo se cambia al editar el perfil */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.settings')}</Text>

          <Text style={styles.fieldLabel}>{t('profile.userType')}</Text>
          {editing ? (
            <View style={styles.segmentRow}>
              {(['individuo', 'comercio'] as UserType[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  testID={`user-type-${opt}`}
                  style={[styles.segmentBtn, userType === opt && styles.segmentBtnActive]}
                  onPress={() => setUserType(opt)}
                >
                  <Text style={[styles.segmentBtnText, userType === opt && styles.segmentBtnTextActive]}>
                    {opt === 'individuo' ? t('profile.userTypeIndividuo') : t('profile.userTypeComercio')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View testID="user-type-display" style={styles.userTypeBox}>
              <Text style={styles.userTypeBoxText}>
                {profile?.userType === 'comercio' ? t('profile.userTypeComercio') : t('profile.userTypeIndividuo')}
              </Text>
            </View>
          )}
          <Text style={styles.segmentHint}>{t('profile.userTypeHint')}</Text>

          <Text style={styles.fieldLabel}>{t('profile.coverageDaysThreshold')}</Text>
          {editing ? (
            <View style={styles.settingRow}>
              <AppTextInput
                testID="coverage-days-input"
                style={[styles.input, styles.settingInput]}
                value={coverageDaysInput}
                onChangeText={setCoverageDaysInput}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.settingUnit}>{t('profile.days')}</Text>
            </View>
          ) : (
            <Text testID="coverage-days-value" style={styles.fieldValue}>
              {profile?.coverageDaysThreshold} {t('profile.days')}
            </Text>
          )}

          <Text style={styles.fieldLabel}>{t('profile.expiryDaysThreshold')}</Text>
          {editing ? (
            <View style={styles.settingRow}>
              <AppTextInput
                testID="expiry-days-input"
                style={[styles.input, styles.settingInput]}
                value={expiryDaysInput}
                onChangeText={setExpiryDaysInput}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.settingUnit}>{t('profile.days')}</Text>
            </View>
          ) : (
            <Text testID="expiry-days-value" style={styles.fieldValue}>
              {profile?.expiryDaysThreshold} {t('profile.days')}
            </Text>
          )}

          <Text style={styles.fieldLabel}>{t('profile.alertCheckHour')}</Text>
          {editing ? (
            <View style={styles.settingRow}>
              <AppTextInput
                testID="alert-hour-input"
                style={[styles.input, styles.settingInput]}
                value={alertCheckHourInput}
                onChangeText={setAlertCheckHourInput}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.settingUnit}>{t('profile.argentinaTime')}</Text>
            </View>
          ) : (
            <Text testID="alert-hour-value" style={styles.fieldValue}>
              {profile ? Math.round(utcToLocal(profile.alertCheckHour)) : ''} {t('profile.argentinaTime')}
            </Text>
          )}
        </View>

        {/* Guardar y cancelar, debajo de todos los campos */}
        {editing && (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? t('profile.saving') : t('profile.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} disabled={saving}>
              <Text style={styles.cancelBtnText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Idioma, notificaciones y cerrar sesión: no están mientras se edita el perfil */}
        {!editing && (
          <>
            <TouchableOpacity style={styles.rowBtn} onPress={askToggleLanguage}>
              <Ionicons name="language-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.rowBtnText}>
                {t('profile.language')}: {i18n.language === 'es' ? '🇦🇷 Español' : '🇺🇸 English'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.placeholder} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => (notificationsEnabled ? setConfirmDisableNotifications(true) : handleActivateNotifications())}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.rowBtnText}>
                {t('profile.notifications')}: {notificationsEnabled ? t('profile.enabled') : t('profile.disabled')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.placeholder} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={() => setConfirmLogoutVisible(true)}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.logoutText}>{t('profile.logout')}</Text>
            </TouchableOpacity>
          </>
        )}

        <ConfirmModal
          visible={pendingLanguage !== null}
          message={t('profile.languageConfirm', { language: pendingLanguage === 'en' ? 'English' : 'Español' })}
          confirmLabel={t('profile.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={confirmLanguageChange}
          onCancel={() => setPendingLanguage(null)}
        />

        <ConfirmModal
          visible={confirmDisableNotifications}
          message={t('profile.disableNotificationsConfirm')}
          confirmLabel={t('profile.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            setConfirmDisableNotifications(false);
            handleActivateNotifications();
          }}
          onCancel={() => setConfirmDisableNotifications(false)}
        />

        <ConfirmModal
          visible={confirmLogoutVisible}
          message={t('profile.logoutConfirm')}
          confirmLabel={t('profile.logoutConfirmAction')}
          cancelLabel={t('common.cancel')}
          onConfirm={handleLogout}
          onCancel={() => setConfirmLogoutVisible(false)}
        />
          </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { position: 'relative', marginTop: 0, marginBottom: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  editIconBtn: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  feedback: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
  feedbackOk: { color: '#2db7a3' },
  feedbackError: { color: Colors.error },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 12,
    elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 12, fontWeight: '600' },
  fieldValue: { fontSize: 15, color: Colors.textPrimary, marginTop: 4 },
  fieldReadOnly: { color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
    marginTop: 4,
    width: '100%',
  },
  editActions: { width: '100%', gap: 10, marginTop: 16 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15 },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    marginTop: 12,
    gap: 12,
    elevation: 1,
  },
  rowBtnText: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    marginTop: 12,
    gap: 12,
    elevation: 1,
  },
  logoutText: { fontSize: 15, color: Colors.error, fontWeight: '600' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentBtnText: { fontSize: 14, color: Colors.textSecondary },
  segmentBtnTextActive: { color: '#fff', fontWeight: '600' },
  // Tipo de cuenta cuando no se edita: del tamaño de un botón y de todo el ancho, pero solo resalta el dato
  userTypeBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: Colors.primary,
  },
  userTypeBoxText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  segmentHint: { fontSize: 12, color: Colors.placeholder, marginTop: 6 },
  settingInput: { width: 80, marginTop: 0 },
  settingUnit: { fontSize: 13, color: Colors.textSecondary },
});
