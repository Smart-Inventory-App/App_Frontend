import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Colors } from '../src/constants/colors';
import HomeHeader from '../src/components/HomeHeader';

describe('HomeHeader', () => {
  it('shows the logo and the greeting in two lines', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    expect(screen.getByTestId('home-logo')).toBeTruthy();
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido,');
    expect(screen.getByTestId('home-name').props.children).toBe('ana');
  });

  it('puts the logo on the left of the greeting', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('home-logo')).toBeLessThan(tree.indexOf('home-greeting'));
  });

  it('shows "Tu estado," with the name below', () => {
    render(<HomeHeader greeting="Tu estado" name="ana" />);
    expect(screen.getByTestId('home-greeting').props.children).toBe('Tu estado,');
  });

  it('cuts names longer than 20 characters, keeping the first 20 followed by "..."', () => {
    render(<HomeHeader greeting="Bienvenido" name="Maximiliano Alejandro Rodriguez" />);
    expect(screen.getByTestId('home-name').props.children).toBe('Maximiliano Alejandr...');
  });

  it('keeps each line to a single line', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    expect(screen.getByTestId('home-greeting').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('home-name').props.numberOfLines).toBe(1);
  });

  it('shows the greeting alone, without a comma, when there is no name', () => {
    render(<HomeHeader greeting="Bienvenido" name="" />);
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido');
    expect(screen.queryByTestId('home-name')).toBeNull();
  });

  it('makes the name bigger than the greeting', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    const greeting = StyleSheet.flatten(screen.getByTestId('home-greeting').props.style);
    const name = StyleSheet.flatten(screen.getByTestId('home-name').props.style);
    expect(name.fontSize).toBeGreaterThan(greeting.fontSize);
  });

  it('has the same color as the labels of the cards, the teal that repeats all over the app', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    expect(StyleSheet.flatten(screen.getByTestId('home-header').props.style).backgroundColor).toBe(Colors.primary);
  });

  it('writes both lines of the greeting in white', () => {
    render(<HomeHeader greeting="Tu estado" name="ana" />);
    expect(StyleSheet.flatten(screen.getByTestId('home-greeting').props.style).color).toBe('#fff');
    expect(StyleSheet.flatten(screen.getByTestId('home-name').props.style).color).toBe('#fff');
  });

  it('shows a logo a bit smaller than before, and keeps the size of the words', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    expect(StyleSheet.flatten(screen.getByTestId('home-logo-frame').props.style)).toMatchObject({ width: 80, height: 80 });
    expect(StyleSheet.flatten(screen.getByTestId('home-greeting').props.style).fontSize).toBe(17);
    expect(StyleSheet.flatten(screen.getByTestId('home-name').props.style).fontSize).toBe(28);
  });

  it('shows just the logo: the icon fills the frame, which gives it rounded corners', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    const frame = StyleSheet.flatten(screen.getByTestId('home-logo-frame').props.style);
    expect(frame.overflow).toBe('hidden');
    expect(frame.borderRadius).toBeGreaterThan(0);
    expect(frame.backgroundColor).toBeUndefined();
    const image = StyleSheet.flatten(screen.getByTestId('home-logo').props.style);
    // la imagen ocupa exactamente el marco (el ícono ya no trae margen blanco)
    expect(image.width).toBe(frame.width);
    expect(image.height).toBe(frame.height);
    expect(image.position).toBeUndefined();
    const banner: any = screen.toJSON();
    expect(banner.children[0].props.testID).toBe('home-logo-frame');
  });

  it('is a low banner: little space above and below the logo', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    const style = StyleSheet.flatten(screen.getByTestId('home-header').props.style);
    expect(style.paddingTop).toBeLessThanOrEqual(12);
    expect(style.paddingBottom).toBeLessThanOrEqual(12);
  });

  it('leaves room for the status bar of the phone', () => {
    const { SafeAreaProvider } = require('react-native-safe-area-context');
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 0 } }}>
        <HomeHeader greeting="Bienvenido" name="ana" />
      </SafeAreaProvider>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('home-header').props.style).paddingTop).toBe(38);
  });

  it('brings the two lines of the greeting close together', () => {
    render(<HomeHeader greeting="Bienvenido" name="ana" />);
    const greeting = StyleSheet.flatten(screen.getByTestId('home-greeting').props.style);
    const name = StyleSheet.flatten(screen.getByTestId('home-name').props.style);
    expect(greeting.lineHeight).toBeLessThanOrEqual(greeting.fontSize + 4);
    expect(name.lineHeight).toBeLessThanOrEqual(name.fontSize + 4);
    expect(name.marginTop ?? 0).toBe(0);
    expect(greeting.marginBottom ?? 0).toBe(0);
  });
});
