import { auth } from '@/lib/firebase';
import { Redirect, Slot } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function TabLayout() {
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size='large' color='#00D4FF' />
      </View>
    );
  }
  if (!user) {
    return <Redirect href='/sign-in' />;
  }
  return <Slot />;
}
