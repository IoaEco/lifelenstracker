import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { ActivityIndicator, View } from 'react-native';

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size='large' color='#00D4FF' />
      </View>
    );
  }
  if (!isSignedIn) {
    return <Redirect href='/sign-in' />;
  }
  return <Slot />;
}
