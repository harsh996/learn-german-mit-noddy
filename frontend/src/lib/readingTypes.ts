export const READING_LEVELS = ["A1", "A2", "B1", "B2"] as const;

export type Story = {
  id: string;
  title: string;
  titleEn: string;
  level: string;
  source: string;
  words: number;
  paragraphs: string[];
};

export type StorySummary = Omit<Story, "paragraphs">;
