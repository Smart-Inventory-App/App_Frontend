import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { useFieldFocus } from '@/components/KeyboardAwareScrollView';

// TextInput que, dentro de un KeyboardAwareScrollView, hace que la pantalla muestre el campo sobre el teclado.
const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({ onFocus, ...rest }, ref) {
  const notifyFocus = useFieldFocus();
  return (
    <TextInput
      ref={ref}
      {...rest}
      onFocus={event => {
        notifyFocus?.();
        onFocus?.(event);
      }}
    />
  );
});

export default AppTextInput;
