import { UserProfile } from "../types";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8034') + '/api.php';

export const generateBio = async (profile: UserProfile): Promise<string> => {
  try {
    const response = await fetch(BACKEND_URL + '?q=generate_bio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            profile: profile
        })
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data.text || "Could not generate bio.";
  } catch (error) {
    console.error("Error generating bio:", error);
    return "Failed to connect to AI server.";
  }
};

export const analyzePortfolio = async (profile: UserProfile): Promise<string> => {
    try {
        const response = await fetch(BACKEND_URL + '?q=analyze_portfolio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                profile: profile
            })
        });
    
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
    
        const data = await response.json();
        return data.text || "Analysis failed.";
      } catch (error) {
        console.error("Error analyzing portfolio:", error);
        return "Could not analyze portfolio.";
      }
  };