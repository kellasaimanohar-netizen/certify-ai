/**
 * Helper to get a dynamic greeting based on the system's local time.
 * - Late Night (10 PM - 3:59 AM): "This is night buddy," 🌙
 * - Morning (4 AM - 11:59 AM): "Good morning," 👋
 * - Afternoon (12 PM - 4:59 PM): "Good afternoon," ☀️
 * - Evening (5 PM - 9:59 PM): "Good evening," 🌆
 */
export interface TimeGreeting {
  greeting: string;
  emoji: string;
  period: 'night' | 'morning' | 'afternoon' | 'evening';
  subtext: string;
}

export function getTimeGreeting(): TimeGreeting {
  const hour = new Date().getHours();

  if (hour >= 22 || hour < 4) {
    return {
      greeting: "This is night buddy,",
      emoji: "🌙",
      period: "night",
      subtext: "Working late? AI testing and certification never sleeps."
    };
  }
  if (hour >= 4 && hour < 12) {
    return {
      greeting: "Good morning,",
      emoji: "👋",
      period: "morning",
      subtext: "Test your AI agents, analyze compliance, and review certification results."
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: "Good afternoon,",
      emoji: "☀️",
      period: "afternoon",
      subtext: "Test your AI agents, analyze compliance, and review certification results."
    };
  }
  return {
    greeting: "Good evening,",
    emoji: "🌆",
    period: "evening",
    subtext: "Review today's test runs and track your AI trust scores."
  };
}
