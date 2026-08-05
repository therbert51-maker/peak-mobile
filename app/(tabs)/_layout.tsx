import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

const TAB_ICON_SIZE = 24;
const SAVE_TAB_ICON_SIZE = 26;

function SaveTabIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={[styles.saveIconWrap, focused && styles.saveIconWrapActive]}>
      <Ionicons name="add-circle" size={SAVE_TAB_ICON_SIZE} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.authGate}>
        <ActivityIndicator size="large" color={PeakColors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PeakColors.tabActive,
        tabBarInactiveTintColor: PeakColors.tabInactive,
        tabBarButton: HapticTab,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="map-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="save"
        options={{
          title: 'Save',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <SaveTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="split"
        options={{
          title: 'Split',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="receipt-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.background,
  },
  tabBar: {
    backgroundColor: PeakColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
    paddingTop: Spacing.xs,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  saveIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 32,
    borderRadius: BorderRadius.pill,
  },
  saveIconWrapActive: {
    backgroundColor: PeakColors.primaryLight,
  },
});
