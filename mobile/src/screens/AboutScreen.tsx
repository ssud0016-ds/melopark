import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AboutCtaBand } from '../components/about/AboutCtaBand';
import { AboutFixSection } from '../components/about/AboutFixSection';
import { AboutFooter } from '../components/about/AboutFooter';
import { AboutHero } from '../components/about/AboutHero';
import { AboutPainSection } from '../components/about/AboutPainSection';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AboutScreen() {
  const navigation = useNavigation<Nav>();
  const scrollRef = useRef<ScrollView>(null);
  const [problemY, setProblemY] = useState(0);

  const goMap = useCallback(() => {
    navigation.navigate('Tabs', { screen: 'MapTab' });
  }, [navigation]);

  const scrollToProblem = useCallback(() => {
    scrollRef.current?.scrollTo({ y: problemY, animated: true });
  }, [problemY]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-surface dark:bg-surface-dark"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <AboutHero onFindParking={goMap} onLearnMore={scrollToProblem} />
      <View
        onLayout={(e) => {
          setProblemY(e.nativeEvent.layout.y);
        }}
      >
        <AboutPainSection />
        <AboutFixSection onCardPress={goMap} />
        <AboutCtaBand onPress={goMap} />
        <AboutFooter navigation={navigation} onGoMap={goMap} onScrollToTop={scrollToTop} />
      </View>
    </ScrollView>
  );
}
