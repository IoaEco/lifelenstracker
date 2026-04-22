import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CategoriesProvider } from "@/context/CategoriesContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { TrackProvider } from "@/context/TrackContext";

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — splash may already be hidden (e.g. Fast Refresh)
});

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="track/[id]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="camera"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="account"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="sign-in"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

function LoadingScreen({ message }: { message?: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0b0b0c",
      }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
      {message ? (
        <Text
          style={{
            color: "#ffffff",
            marginTop: 16,
            fontSize: 14,
            textAlign: "center",
            paddingHorizontal: 32,
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.warn("Font loading error:", fontError);
    }
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        // ignore — splash may already be hidden
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <LoadingScreen />;
  }

  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Restart the dev workflow after enabling auth.",
    );
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <QueryClientProvider client={queryClient}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <CategoriesProvider>
                      <TrackProvider>
                        <RootLayoutNav />
                      </TrackProvider>
                    </CategoriesProvider>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </QueryClientProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
