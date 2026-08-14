import { Ionicons } from '@expo/vector-icons';
import { useRef, type ComponentProps } from 'react';
import { Alert, Animated, StyleSheet, Text } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import { ExpenseListItem } from '@/components/expenses/ExpenseListItem';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import type { ManualExpense } from '@/lib/expenses';
import type { TripMember } from '@/lib/trip-members';

const ACTION_WIDTH = 76;

type SwipeableExpenseListItemProps = {
  expense: ManualExpense;
  membersById: Map<string, TripMember>;
  canManage: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSwipeableOpen?: (ref: Swipeable) => void;
};

function SwipeAction({
  label,
  icon,
  backgroundColor,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  backgroundColor: string;
  onPress: () => void;
}) {
  return (
    <RectButton style={[styles.actionButton, { backgroundColor }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={PeakColors.textInverse} />
      <Text style={styles.actionLabel}>{label}</Text>
    </RectButton>
  );
}

export function SwipeableExpenseListItem({
  expense,
  membersById,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  onSwipeableOpen,
}: SwipeableExpenseListItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = () => {
    swipeableRef.current?.close();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete expense?',
      'This permanently deletes the expense, receipt image, and processing data.',
      [
        { text: 'Cancel', style: 'cancel', onPress: closeSwipe },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            closeSwipe();
            onDelete();
          },
        },
      ],
    );
  };

  const showActionSheet = () => {
    if (!canManage) return;

    Alert.alert(expense.title, 'Choose an action', [
      {
        text: 'Edit',
        onPress: onEdit,
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: confirmDelete,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-ACTION_WIDTH * 2, 0],
      outputRange: [0, ACTION_WIDTH * 2],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.actionsRow, { transform: [{ translateX }] }]}>
        <SwipeAction
          label="Edit"
          icon="pencil-outline"
          backgroundColor={PeakColors.primary}
          onPress={() => {
            closeSwipe();
            onEdit();
          }}
        />
        <SwipeAction
          label="Delete"
          icon="trash-outline"
          backgroundColor={PeakColors.error}
          onPress={confirmDelete}
        />
      </Animated.View>
    );
  };

  const card = (
    <ExpenseListItem
      expense={expense}
      membersById={membersById}
      onPress={onOpen}
      onLongPress={canManage ? showActionSheet : undefined}
    />
  );

  if (!canManage) {
    return card;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootRight={false}
      rightThreshold={ACTION_WIDTH}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() => {
        if (swipeableRef.current) {
          onSwipeableOpen?.(swipeableRef.current);
        }
      }}>
      {card}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  actionButton: {
    width: ACTION_WIDTH,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: BorderRadius.large,
    marginLeft: Spacing.xs,
  },
  actionLabel: {
    ...Typography.caption,
    color: PeakColors.textInverse,
    fontWeight: '700',
  },
});
