import { useFonts, Varela_400Regular } from '@expo-google-fonts/varela';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, LogIn, LogOut, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Workout = {
  name: string;
  sets: number;
  reps: number;
};

const FONT_FAMILY = 'Varela_400Regular';
const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const WORKOUT_SEQUENCE: Workout[] = [
  { name: 'Leg Press', sets: 3, reps: 10 },
{ name: 'Leg Extension', sets: 2, reps: 10 },
{ name: 'Chest Press', sets: 3, reps: 10 },
{ name: 'Seated Row', sets: 3, reps: 10 },
{ name: 'Machine Crunch', sets: 3, reps: 10 },
{ name: 'Seated Leg Curl', sets: 2, reps: 10 },
{ name: 'Shoulder Press', sets: 3, reps: 10 },
{ name: 'Lat Pulldown', sets: 3, reps: 10 },
{ name: 'Back Extension', sets: 3, reps: 10 },  
{ name: 'Bicep Curl Machine', sets: 2, reps: 12 },
];

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({ Varela_400Regular });
  const [loggedIn, setLoggedIn] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [tutorialLinks, setTutorialLinks] = useState<Record<string, string>>({});
  const [isFetchingTutorial, setIsFetchingTutorial] = useState(false);
  
  // Animation for loading snackbar
  const snackbarAnimation = useState(new Animated.Value(0))[0];
  const pulseAnimation = useState(new Animated.Value(0))[0];

  // Animate snackbar when loading state changes
  useEffect(() => {
    if (isFetchingTutorial) {
      // Show snackbar
      Animated.spring(snackbarAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      // Start pulsing animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      
      return () => pulseLoop.stop();
    } else {
      // Hide snackbar
      Animated.spring(snackbarAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [isFetchingTutorial, snackbarAnimation, pulseAnimation]);

  const totalExercises = WORKOUT_SEQUENCE.length;
  const safeIndex = Math.min(Math.max(currentExerciseIndex, 0), totalExercises - 1);
  const currentExercise = WORKOUT_SEQUENCE[safeIndex];
  const progress = totalExercises ? (safeIndex + 1) / totalExercises : 0;

  const handleCompleted = () => {
    if (safeIndex >= totalExercises - 1) return;
    setCurrentExerciseIndex(prev => prev + 1);
  };

  const handleNotQuite = () => {
    if (safeIndex <= 0) return;
    setCurrentExerciseIndex(prev => prev - 1);
  };

  const handleAuthToggle = () => {
    setLoggedIn(prev => !prev);
    setCurrentExerciseIndex(0);
  };

  const generateTutorialSearchUrl = useCallback(
    async (exerciseName: string): Promise<string | null> => {
      const cached = tutorialLinks[exerciseName];
      if (cached) {
        return cached;
      }

      if (!OPENAI_API_KEY) {
        Alert.alert(
          'Missing API key',
          'Set EXPO_PUBLIC_OPENAI_API_KEY in your environment to generate tutorial search terms via ChatGPT.',
        );
        return null;
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              {
                role: 'user',
                content: `Generate the best YouTube search terms to find tutorial videos for the exercise: "${exerciseName}". 

The search should find videos that:
- Show proper form and technique
- Are suitable for beginners
- Focus on safety and correct execution
- Are preferably short tutorial videos

Please respond with ONLY a JSON object in this exact format:
{"searchTerms": "exercise name form tutorial technique"}

Keep the search terms concise but specific enough to find quality instructional videos.`
              }
            ],
            response_format: {
              type: 'json_object'
            },
            max_tokens: 100,
            temperature: 0.3
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Invalid response from OpenAI');
        }

        const parsed = JSON.parse(content);
        const searchTerms = typeof parsed?.searchTerms === 'string' ? parsed.searchTerms : null;
        if (searchTerms) {
          // Create YouTube search URL that will show relevant videos
          const encodedSearch = encodeURIComponent(searchTerms);
          const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodedSearch}`;
          setTutorialLinks(prev => ({ ...prev, [exerciseName]: youtubeSearchUrl }));
          return youtubeSearchUrl;
        }
        return null;
      } catch (error) {
        console.error('Search terms generation failed', error);
        Alert.alert('Unable to generate search terms', 'Please try again in a moment.');
        return null;
      }
    },
    [tutorialLinks],
  );

  const handleOpenTutorial = useCallback(async () => {
    if (!loggedIn || isFetchingTutorial) return;

    setIsFetchingTutorial(true);
    try {
      const link = await generateTutorialSearchUrl(currentExercise.name);
      if (!link) return;
      const supported = await Linking.canOpenURL(link);
      if (!supported) {
        Alert.alert('Unable to open YouTube search', 'Please try again later.');
        return;
      }
      Linking.openURL(link);
    } finally {
      setIsFetchingTutorial(false);
    }
  }, [currentExercise.name, isFetchingTutorial, loggedIn, generateTutorialSearchUrl]);

  const titleText = loggedIn ? currentExercise.name : 'Ready when you are';
  const subtitleText = loggedIn
    ? `${currentExercise.sets} sets x ${currentExercise.reps} reps`
    : 'Log in to restart your session';

  const AuthIcon = loggedIn ? LogOut : LogIn;

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LinearGradient
      colors={['#dff5e8', '#e9f7ef', '#fafafa']}
      locations={[0, 0.55, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleAuthToggle} activeOpacity={0.8}>
            <AuthIcon color="#1f3c2a" size={24} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loggedIn && (
          <View style={styles.progressWrapper}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.content}>
          <TouchableOpacity
            activeOpacity={loggedIn ? 0.7 : 1}
            onPress={handleOpenTutorial}
            disabled={!loggedIn}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={styles.primaryText}>{titleText}</Text>
          </TouchableOpacity>
          <Text style={styles.secondaryText}>{subtitleText}</Text>
        </View>

        {loggedIn && (
          <View style={styles.actions}>
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.circleButton, styles.circleMuted]}
                onPress={handleNotQuite}
                activeOpacity={0.85}>
                <X color="#4c4f4c" size={30} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Not Quite</Text>
            </View>
            <View style={styles.actionItem}>
              <TouchableOpacity
                style={[styles.circleButton, styles.circleAccent]}
                onPress={handleCompleted}
                activeOpacity={0.85}>
                <Check color="#ffffff" size={30} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Completed</Text>
            </View>
          </View>
        )}
        
        {/* Loading Snackbar */}
        <Animated.View 
          style={[
            styles.snackbar,
            {
              transform: [{
                translateY: snackbarAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                })
              }],
              opacity: snackbarAnimation,
            }
          ]}
        >
          <View style={styles.snackbarContent}>
            <Animated.View 
              style={[
                styles.loadingDot,
                {
                  opacity: pulseAnimation.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.4, 1],
                  }),
                  transform: [{
                    scale: pulseAnimation.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.8, 1.2],
                    })
                  }]
                }
              ]}
            />
            <Text style={styles.snackbarText}>Finding tutorial videos...</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 8,
  },
  progressWrapper: {
    marginTop: 24,
    marginHorizontal: 24,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#1f9c6d',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 125,
  },
  primaryText: {
    fontSize: 32,
    fontWeight: '500',
    color: '#1E1E1E',
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  secondaryText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '500',
    color: '#898989',
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingBottom: 75,
  },
  actionItem: {
    alignItems: 'center',
  },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleMuted: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  circleAccent: {
    backgroundColor: '#1f9c6d',
  },
  actionLabel: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#898989',
    fontFamily: FONT_FAMILY,
  },
  snackbar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1f3c2a',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1f9c6d',
    marginRight: 12,
  },
  snackbarText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    fontFamily: FONT_FAMILY,
  },
});
