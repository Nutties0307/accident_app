import React from 'react';
import { ImageBackground, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

type Props = {
  height?: number;
  children?: React.ReactNode;
};

export default function OrganicHeader({ height = 300, children }: Props) {
  return (
    <ImageBackground
      source={require('../../assets/images/header-bg.jpg')}
      style={[styles.container, { height, width }]}
      resizeMode="cover"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
});