import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const spaces = [
  {
    id: '1',
    emoji: '🇪🇸',
    title: 'Spain 2026',
    subtitle: '8 places saved',
  },
  {
    id: '2',
    emoji: '⛷️',
    title: 'Ski Trips',
    subtitle: '12 places saved',
  },
  {
    id: '3',
    emoji: '🍷',
    title: 'Italy',
    subtitle: '6 places saved',
  },
];

const inspiration = [
  {
    id: '1',
    emoji: '🌊',
    title: 'Hidden beach in Mallorca',
    location: 'Mallorca, Spain',
  },
  {
    id: '2',
    emoji: '🍸',
    title: 'Rooftop cocktails',
    location: 'Lisbon, Portugal',
  },
  {
    id: '3',
    emoji: '🍜',
    title: 'Late-night ramen',
    location: 'Tokyo, Japan',
  },
];

export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PEAK</Text>
          <Text style={styles.greeting}>Good evening, Ty</Text>
        </View>

        <TouchableOpacity style={styles.profileButton}>
          <Text style={styles.profileText}>TH</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>YOUR NEXT ADVENTURE</Text>
        <Text style={styles.heroTitle}>
          Save the inspiration.{'\n'}Plan the trip.
        </Text>
        <Text style={styles.heroDescription}>
          Keep every restaurant, beach, hotel and hidden gem in one place.
        </Text>

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>＋ Save inspiration</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your spaces</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {spaces.map((space) => (
          <TouchableOpacity key={space.id} style={styles.spaceCard}>
            <Text style={styles.spaceEmoji}>{space.emoji}</Text>
            <Text style={styles.spaceTitle}>{space.title}</Text>
            <Text style={styles.spaceSubtitle}>{space.subtitle}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.spaceCard, styles.newSpaceCard]}>
          <Text style={styles.newSpaceIcon}>＋</Text>
          <Text style={styles.newSpaceText}>New space</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent inspiration</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inspirationList}>
        {inspiration.map((item) => (
          <TouchableOpacity key={item.id} style={styles.inspirationCard}>
            <View style={styles.inspirationImage}>
              <Text style={styles.inspirationEmoji}>{item.emoji}</Text>
            </View>

            <View style={styles.inspirationDetails}>
              <Text style={styles.inspirationTitle}>{item.title}</Text>
              <Text style={styles.inspirationLocation}>{item.location}</Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.splitCard}>
        <View style={styles.splitIcon}>
          <Text style={styles.splitEmoji}>🧾</Text>
        </View>

        <View style={styles.splitContent}>
          <Text style={styles.splitLabel}>PEAK SPLIT</Text>
          <Text style={styles.splitTitle}>Dinner math without the drama.</Text>
          <Text style={styles.splitDescription}>
            Scan a receipt, claim your items and see who owes what.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F5F1',
  },
  content: {
    paddingTop: 68,
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 22,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    marginBottom: 5,
    color: '#DF603B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  greeting: {
    color: '#171A17',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171A17',
  },
  profileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hero: {
    marginHorizontal: 18,
    marginBottom: 34,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#18392D',
  },
  heroLabel: {
    marginBottom: 12,
    color: '#BFD2C6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -1.2,
  },
  heroDescription: {
    maxWidth: 300,
    marginTop: 14,
    color: '#D7E2DB',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    marginTop: 24,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: '#F4A36C',
  },
  primaryButtonText: {
    color: '#18211D',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: 22,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#171A17',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionAction: {
    color: '#607068',
    fontSize: 14,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 18,
    paddingBottom: 35,
    gap: 12,
  },
  spaceCard: {
    width: 155,
    minHeight: 160,
    padding: 18,
    borderRadius: 24,
    justifyContent: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  spaceEmoji: {
    marginBottom: 'auto',
    fontSize: 34,
  },
  spaceTitle: {
    color: '#171A17',
    fontSize: 17,
    fontWeight: '700',
  },
  spaceSubtitle: {
    marginTop: 5,
    color: '#7B817D',
    fontSize: 13,
  },
  newSpaceCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C8CBC8',
    backgroundColor: 'transparent',
  },
  newSpaceIcon: {
    marginBottom: 8,
    color: '#38413D',
    fontSize: 31,
    fontWeight: '300',
  },
  newSpaceText: {
    color: '#38413D',
    fontSize: 14,
    fontWeight: '600',
  },
  inspirationList: {
    paddingHorizontal: 18,
    marginBottom: 32,
    gap: 10,
  },
  inspirationCard: {
    padding: 11,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  inspirationImage: {
    width: 64,
    height: 64,
    marginRight: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEEDE7',
  },
  inspirationEmoji: {
    fontSize: 31,
  },
  inspirationDetails: {
    flex: 1,
  },
  inspirationTitle: {
    color: '#171A17',
    fontSize: 15,
    fontWeight: '700',
  },
  inspirationLocation: {
    marginTop: 5,
    color: '#7B817D',
    fontSize: 13,
  },
  chevron: {
    paddingHorizontal: 8,
    color: '#A1A6A2',
    fontSize: 28,
    fontWeight: '300',
  },
  splitCard: {
    marginHorizontal: 18,
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    backgroundColor: '#EAD9CA',
  },
  splitIcon: {
    width: 54,
    height: 54,
    marginRight: 15,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  splitEmoji: {
    fontSize: 27,
  },
  splitContent: {
    flex: 1,
  },
  splitLabel: {
    marginBottom: 5,
    color: '#9A4B32',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  splitTitle: {
    color: '#31241E',
    fontSize: 17,
    fontWeight: '700',
  },
  splitDescription: {
    marginTop: 6,
    color: '#6E5548',
    fontSize: 13,
    lineHeight: 19,
  },
});
