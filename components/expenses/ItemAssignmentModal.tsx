import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  tripMemberDisplayName,
  tripMemberInitials,
  type TripMember,
} from '@/lib/trip-members';

type ItemAssignmentModalProps = {
  visible: boolean;
  itemName: string;
  members: TripMember[];
  selectedUserIds: string[];
  onClose: () => void;
  onSave: (userIds: string[]) => void;
};

export function ItemAssignmentModal({
  visible,
  itemName,
  members,
  selectedUserIds,
  onClose,
  onSave,
}: ItemAssignmentModalProps) {
  const [draft, setDraft] = useState<string[]>([]);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const memberIds = new Set(members.map((member) => member.userId));
      setDraft(selectedUserIds.filter((userId) => memberIds.has(userId)));
    }
    wasVisible.current = visible;
  }, [members, selectedUserIds, visible]);

  const everyoneSelected = members.length > 0 && draft.length === members.length;

  const toggleMember = (userId: string) => {
    setDraft((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId],
    );
  };

  const toggleEveryone = () => {
    setDraft(everyoneSelected ? [] : members.map((member) => member.userId));
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Assign item</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {itemName}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: everyoneSelected }}
            onPress={toggleEveryone}
            style={[styles.everyoneRow, everyoneSelected && styles.selectedRow]}>
            <View style={styles.everyoneIcon}>
              <Ionicons name="people" size={22} color={PeakColors.primary} />
            </View>
            <View style={styles.memberText}>
              <Text style={styles.memberName}>Everyone</Text>
              <Text style={styles.memberMeta}>Split evenly across all Space members</Text>
            </View>
            <Ionicons
              name={everyoneSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={PeakColors.primary}
            />
          </Pressable>

          <Text style={styles.sectionLabel}>Members</Text>
          {members.map((member) => {
            const selected = draft.includes(member.userId);
            const avatarUrl = member.profile?.avatar_url;
            return (
              <Pressable
                key={member.userId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleMember(member.userId)}
                style={[styles.memberRow, selected && styles.selectedRow]}>
                <Avatar
                  size="sm"
                  initials={tripMemberInitials(member)}
                  source={avatarUrl ? { uri: avatarUrl } : undefined}
                  backgroundColor={PeakColors.navy}
                />
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>{tripMemberDisplayName(member)}</Text>
                  <Text style={styles.memberMeta}>
                    {member.role === 'owner'
                      ? 'Space owner'
                      : `Member · ${tripMemberInitials(member)}`}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={PeakColors.primary}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.selectionHint}>
            {draft.length === 0
              ? 'No members selected — this item will be unassigned'
              : `${draft.length} ${draft.length === 1 ? 'member' : 'members'} selected`}
          </Text>
          <PeakButton
            fullWidth
            title="Done"
            onPress={() => onSave(draft)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  everyoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.large,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
    marginBottom: Spacing.md,
  },
  everyoneIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.primaryLight,
  },
  sectionLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  selectedRow: {
    borderColor: PeakColors.primary,
    backgroundColor: PeakColors.primaryLight,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    ...Typography.label,
  },
  memberMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
    backgroundColor: PeakColors.background,
  },
  selectionHint: {
    ...Typography.caption,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
