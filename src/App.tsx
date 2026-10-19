/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { BackendModal } from './components/BackendModal.tsx';
import { TestStudio } from './components/TestStudio.tsx';
import { VoiceLab } from './components/VoiceLab.tsx';
import { SermonStudio } from './components/SermonStudio.tsx';
import { Library, LibraryItem } from './components/Library.tsx';
import { ModelAnalysis } from './components/ModelAnalysis.tsx';
import { OpenBackendStatus, VoiceProfile } from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'test' | 'voicelab' | 'sermon' | 'library' | 'analysis'>('test');
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<OpenBackendStatus | null>(null);

  // User's voice profiles (mapped to their real uploaded sermon files on backend)
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  // Library of generated sermon files
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);

  // Check Open AI Backend health & connectivity
  const checkBackendStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/open-backend/status');
      if (res.ok) {
        const data = await res.json();
        setBackendStatus(data);
      }
    } catch {
      // Backend is offline or starting up
    }
  }, []);

  // Fetch real stored voice profiles
  const fetchVoiceProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/voice-profiles');
      if (res.ok) {
        const profiles: VoiceProfile[] = await res.json();
        setVoiceProfiles(profiles);
        if (profiles.length > 0 && !activeProfileId) {
          setActiveProfileId(profiles[0].id);
        }
      }
    } catch {
      console.warn('Kunne ikke hente stemmeprofiler fra serveren.');
    }
  }, [activeProfileId]);

  useEffect(() => {
    checkBackendStatus();
    fetchVoiceProfiles();
  }, [checkBackendStatus, fetchVoiceProfiles]);

  const handleProfileCreated = (newProfile: VoiceProfile) => {
    setVoiceProfiles((prev) => [newProfile, ...prev]);
    setActiveProfileId(newProfile.id);
  };

  const handleProfileDeleted = (profileId: string) => {
    setVoiceProfiles((prev) => prev.filter((p) => p.id !== profileId));
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }
  };

  const handleSaveToLibrary = (record: {
    title: string;
    text: string;
    voiceName: string;
    voiceId: string;
    audioBlob: Blob;
    durationSeconds: number;
  }) => {
    const newItem: LibraryItem = {
      id: `lib-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: record.title,
      textExcerpt: record.text.slice(0, 100),
      voiceName: record.voiceName,
      voiceId: record.voiceId,
      audioBlob: record.audioBlob,
      audioUrl: URL.createObjectURL(record.audioBlob),
      durationSeconds: record.durationSeconds,
      createdAt: new Date().toISOString(),
    };

    setLibraryItems((prev) => [newItem, ...prev]);
  };

  const handleDeleteLibraryItem = (id: string) => {
    setLibraryItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.audioUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleOpenSermon = (_item: LibraryItem) => {
    setActiveTab('sermon');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        onOpenBackendModal={() => setIsBackendModalOpen(true)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'test' && (
          <TestStudio
            backendStatus={backendStatus}
            onOpenBackendModal={() => setIsBackendModalOpen(true)}
            voiceProfiles={voiceProfiles}
            onProfileCreated={handleProfileCreated}
            onSaveGeneratedAudio={handleSaveToLibrary}
          />
        )}

        {activeTab === 'voicelab' && (
          <VoiceLab
            backendStatus={backendStatus}
            onOpenBackendModal={() => setIsBackendModalOpen(true)}
            voiceProfiles={voiceProfiles}
            onProfileCreated={handleProfileCreated}
            onProfileDeleted={handleProfileDeleted}
            activeProfileId={activeProfileId}
            setActiveProfileId={setActiveProfileId}
          />
        )}

        {activeTab === 'sermon' && (
          <SermonStudio
            backendStatus={backendStatus}
            onOpenBackendModal={() => setIsBackendModalOpen(true)}
            voiceProfiles={voiceProfiles}
            activeProfileId={activeProfileId}
            onSaveToLibrary={handleSaveToLibrary}
          />
        )}

        {activeTab === 'library' && (
          <Library
            items={libraryItems}
            onDeleteItem={handleDeleteLibraryItem}
            voiceProfiles={voiceProfiles}
            onOpenSermon={handleOpenSermon}
          />
        )}

        {activeTab === 'analysis' && <ModelAnalysis />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 text-center">
        <p>
          TaleLab · Åpen norsk AI-stemmelab for predikanter · Drevet av Resemble AI Chatterbox Multilingual (MIT)
        </p>
      </footer>

      {/* Backend Settings & Status Modal */}
      <BackendModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        backendStatus={backendStatus}
        onRefreshStatus={checkBackendStatus}
      />
    </div>
  );
}
