
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { VideoGenerator } from './components/VideoGenerator';
import { Pricing } from './components/Pricing';
import { VideoMode, GenerationHistory, UserProfile } from './types';
import { DEFAULT_PROFILE } from './constants';

const App: React.FC = () => {
  const [history, setHistory] = useState<GenerationHistory[]>(() => {
    const saved = localStorage.getItem('veopro_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('veopro_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  // Persistent Script States
  const [analyzedScript, setAnalyzedScript] = useState(() => localStorage.getItem('veopro_analyzed_script') || '');
  const [directorScript, setDirectorScript] = useState(() => localStorage.getItem('veopro_director_script') || '');
  const [seamlessScript, setSeamlessScript] = useState(() => localStorage.getItem('veopro_seamless_script') || '');
  const [targetLink, setTargetLink] = useState(() => localStorage.getItem('veopro_target_link') || '');

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    localStorage.setItem('veopro_analyzed_script', analyzedScript);
  }, [analyzedScript]);

  useEffect(() => {
    localStorage.setItem('veopro_director_script', directorScript);
  }, [directorScript]);

  useEffect(() => {
    localStorage.setItem('veopro_seamless_script', seamlessScript);
  }, [seamlessScript]);

  useEffect(() => {
    localStorage.setItem('veopro_target_link', targetLink);
  }, [targetLink]);

  const addToHistory = (item: GenerationHistory) => {
    const newHistory = [item, ...history];
    setHistory(newHistory);
    localStorage.setItem('veopro_history', JSON.stringify(newHistory));
  };

  const updateProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    localStorage.setItem('veopro_profile', JSON.stringify(newProfile));
  };

  const handleOpenKeyPicker = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  return (
    <Layout 
      activeTab={showPricing ? 'pricing' : 'generate'} 
      setActiveTab={(tab) => tab === 'pricing' ? setShowPricing(true) : setShowPricing(false)} 
      hasApiKey={hasApiKey}
      onOpenKeyPicker={handleOpenKeyPicker}
      profile={profile}
      onProfileUpdate={updateProfile}
      usageCount={history.length}
    >
      <VideoGenerator 
        onGenerated={addToHistory} 
        history={history} 
        onOpenPricing={() => setShowPricing(true)}
        profile={profile}
        onKeyError={() => setHasApiKey(false)}
        // Lifted states
        analyzedScript={analyzedScript}
        setAnalyzedScript={setAnalyzedScript}
        directorScript={directorScript}
        setDirectorScript={setDirectorScript}
        seamlessScript={seamlessScript}
        setSeamlessScript={setSeamlessScript}
        targetLink={targetLink}
        setTargetLink={setTargetLink}
      />

      {showPricing && (
        <Pricing onClose={() => setShowPricing(false)} />
      )}
    </Layout>
  );
};

export default App;
