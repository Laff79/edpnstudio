import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Guitar, Drum, Music2, Headphones, Activity, User, 
  Clock, FileText, Coffee, Share2, AlignLeft, Sparkles, X, Power,
  ChevronDown, ChevronUp, Wifi, WifiOff, Mic2, Ban
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc 
} from 'firebase/firestore';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyCl2o4FtwSfqgoEZiVMQC-VW8cxLw5JVxM",
  authDomain: "edpnstudio.firebaseapp.com",
  projectId: "edpnstudio",
  storageBucket: "edpnstudio.firebasestorage.app",
  messagingSenderId: "711525242568",
  appId: "1:711525242568:web:882d454c26efbb6386b7fd",
  measurementId: "G-W4JJYE7CLZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "edpn-production"; 

// --- TYPES ---
// La til 'skipped' status
type Status = 'todo' | 'recording' | 'done' | 'skipped' | 'mix_v1' | 'mix_v2' | 'master';

interface SongParts {
  [key: string]: Status;
}

interface Song {
  id: string;
  title: string;
  bpm: string;
  key: string;
  notes: string;
  lyrics: string;
  isCollapsed: boolean;
  parts: SongParts;
}

interface Consumption {
  coffee: number;
  snus: number;
}

// --- CONSTANTS ---
// Oppdatert liste med instrumenter
const TRACKS = [
  { key: 'drums', label: 'Trommer', icon: Drum },
  { key: 'bass', label: 'Bass', icon: Activity },
  { key: 'torbjorn_akustisk', label: 'Tor Ak.', icon: Guitar },
  { key: 'laff_akustisk', label: 'Laff Ak.', icon: Guitar },
  { key: 'laff_elektrisk', label: 'Laff El.', icon: Guitar },
  { key: 'keys', label: 'Keys', icon: Music2 },
  { key: 'lars_kor', label: 'Lars Kor', icon: Mic2 },
  { key: 'laff_kor', label: 'Laff Kor', icon: Mic2 },
  { key: 'torbjorn_vokal', label: 'Tor Vok', icon: User },
  { key: 'mixing', label: 'Mix', icon: Headphones },
];

const DEFAULT_PARTS: SongParts = {
  drums: 'todo',
  bass: 'todo',
  torbjorn_akustisk: 'todo',
  laff_akustisk: 'todo',
  laff_elektrisk: 'todo',
  keys: 'todo',
  lars_kor: 'todo',
  laff_kor: 'todo',
  torbjorn_vokal: 'todo',
  mixing: 'todo',
};

const STRATEGIES = [
  "Less is more.", "Hva er fokuset?", "Ta en pause.", "Fjern, ikke legg til.",
  "Er tempoet riktig?", "Gjør det enklere.", "Stol på prosessen.", 
  "Tenk dynamikk.", "Hva ville Rick Rubin gjort?", "Kill your darlings."
];

// --- COMPONENTS ---

const DigitalDisplay = ({ value, onChange, placeholder, isCollapsed }: { value: string, onChange: (val: string) => void, placeholder: string, isCollapsed: boolean }) => (
  <div className={`relative group bg-black border border-slate-800 rounded flex items-center overflow-hidden transition-all ${isCollapsed ? 'h-10' : 'h-14'}`}>
    <div className="absolute inset-0 bg-cyan-900/5 pointer-events-none"></div>
    <div className="absolute left-0 w-1 h-full bg-cyan-600"></div>
    <input 
      className={`relative z-10 w-full bg-transparent border-none focus:ring-0 px-4 text-cyan-50 font-mono font-bold tracking-wider placeholder:text-slate-700 transition-all ${isCollapsed ? 'text-lg' : 'text-xl sm:text-2xl'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const LedLight = ({ status }: { status: Status }) => {
  let colorClass = 'bg-slate-800';
  let shadowClass = '';
  
  if (status === 'done' || status === 'master') {
    colorClass = 'bg-cyan-400'; shadowClass = 'shadow-[0_0_8px_rgba(34,211,238,0.8)]';
  } else if (status === 'recording') {
    colorClass = 'bg-red-500 animate-pulse'; shadowClass = 'shadow-[0_0_8px_rgba(239,68,68,0.8)]';
  } else if (status === 'mix_v1') {
    colorClass = 'bg-yellow-400'; shadowClass = 'shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  } else if (status === 'mix_v2') {
    colorClass = 'bg-orange-500'; shadowClass = 'shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  } else if (status === 'skipped') {
    return <div className="w-1.5 h-1.5 rounded-full bg-black border border-slate-700"></div>;
  }

  return <div className={`w-1.5 h-1.5 rounded-full ${colorClass} ${shadowClass} transition-all duration-300`}></div>;
};

// --- MAIN APP ---
export default function StudioTracker() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [consumption, setConsumption] = useState<Consumption>({ coffee: 0, snus: 0 });
  const [newSongTitle, setNewSongTitle] = useState('');
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<'notes' | 'lyrics' | null>(null);
  const [recordingMode, setRecordingMode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [oracleMsg, setOracleMsg] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  // 1. AUTHENTICATION
  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
      console.error("Auth failed:", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC - SONGS
  useEffect(() => {
    if (!user) return;
    const songsQuery = collection(db, 'artifacts', appId, 'public', 'data', 'songs');
    
    const unsubscribe = onSnapshot(songsQuery, (snapshot) => {
      const loadedSongs: Song[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Song));
      
      loadedSongs.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(loadedSongs);
    }, (error) => {
      console.error("Sync error songs:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. DATA SYNC - CONSUMPTION
  useEffect(() => {
    if (!user) return;
    const consumRef = doc(db, 'artifacts', appId, 'public', 'data', 'consumption', 'global_stats');
    
    const unsubscribe = onSnapshot(consumRef, (docSnap) => {
      if (docSnap.exists()) {
        setConsumption(docSnap.data() as Consumption);
      } else {
        setDoc(consumRef, { coffee: 0, snus: 0 });
      }
    }, (error) => {
      console.error("Sync error consumption:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- ACTIONS ---

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim() || !user) return;
    
    const newSong: Omit<Song, 'id'> = {
      title: newSongTitle,
      bpm: '', key: '', notes: '', lyrics: '', 
      isCollapsed: false, 
      parts: { ...DEFAULT_PARTS },
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'songs'), newSong);
      setNewSongTitle('');
    } catch (e) {
      console.error("Error adding song:", e);
    }
  };

  const deleteSong = async (id: string) => {
    if (!user || !window.confirm('Slette dette sporet fra databasen?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id));
    } catch (e) {
      console.error("Error deleting song:", e);
    }
  };

  const updateSongField = async (id: string, field: keyof Song, value: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id), {
        [field]: value
      });
    } catch (e) { console.error("Update error:", e); }
  };

  const updateSongPart = async (id: string, parts: SongParts) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id), {
        parts: parts
      });
    } catch (e) { console.error("Part update error:", e); }
  };

  const updateConsumption = async (type: 'coffee' | 'snus') => {
    if (!user) return;
    const newVal = consumption[type] + 1;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumption', 'global_stats'), {
        [type]: newVal
      });
    } catch (e) { console.error("Consumption error:", e); }
  };

  const cycleStatus = (song: Song, part: string) => {
    const current = song.parts[part] || 'todo';
    let next: Status = 'todo';
    
    if (part === 'mixing') {
       if (current === 'todo') next = 'mix_v1';
       else if (current === 'mix_v1') next = 'mix_v2';
       else if (current === 'mix_v2') next = 'master'; 
       else if (current === 'master') next = 'todo';
       else next = 'todo';
    } else {
      if (current === 'todo') next = 'recording';
      else if (current === 'recording') next = 'done';
      else if (current === 'done') next = 'skipped'; // Lagt til "Ikke i bruk"
      else if (current === 'skipped') next = 'todo';
      else next = 'todo';
    }

    updateSongPart(song.id, { ...song.parts, [part]: next });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };

  const askOracle = () => {
    const random = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
    setOracleMsg(random);
    setTimeout(() => setOracleMsg(null), 5000);
  };

  const copyReport = () => {
    const totalProgress = calculateProgress();
    let report = `🎚️ DELTA STUDIO STATUS\n`;
    report += `Status: ${totalProgress}% | Kaffe: ${consumption.coffee} | Snus: ${consumption.snus}\n`;
    songs.forEach(song => {
      // Filtrerer bort 'skipped' fra tellingen
      const activeParts = Object.values(song.parts).filter(s => s !== 'skipped');
      const partsDone = activeParts.filter(s => s === 'done' || s === 'master').length;
      const isComplete = partsDone === activeParts.length && activeParts.length > 0;
      
      report += `${isComplete ? '✅' : '🚧'} ${song.title}\n`;
    });
    navigator.clipboard.writeText(report);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const calculateProgress = () => {
    if (songs.length === 0) return 0;
    
    let totalActiveParts = 0;
    let totalCompletedValue = 0;

    songs.forEach(song => {
      TRACKS.forEach(track => {
        const status = song.parts[track.key] || 'todo';
        
        if (status !== 'skipped') {
          totalActiveParts += 1;
          
          if (status === 'done' || status === 'master') totalCompletedValue += 1;
          else if (status === 'recording' || status === 'mix_v1') totalCompletedValue += 0.5;
          else if (status === 'mix_v2') totalCompletedValue += 0.8;
        }
      });
    });

    if (totalActiveParts === 0) return 0;
    return Math.round((totalCompletedValue / totalActiveParts) * 100);
  };

  const getStatusLabel = (track: string, status: Status) => {
    if (status === 'skipped') return '-';
    if (track !== 'mixing') return track.substring(0, 3);
    if (status === 'todo') return 'MIX';
    if (status === 'mix_v1') return 'V.1';
    if (status === 'mix_v2') return 'V.2';
    if (status === 'master') return 'MST';
    return 'MIX';
  };

  const getButtonClass = (status: Status) => {
    const base = "relative flex flex-col items-center justify-center p-2 rounded transition-all duration-200 border border-transparent";
    switch (status) {
      case 'master':
      case 'done': return `${base} bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20`;
      case 'recording': return `${base} bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20`;
      case 'mix_v1': return `${base} bg-yellow-500/10 border-yellow-500/50 text-yellow-400`;
      case 'mix_v2': return `${base} bg-orange-500/10 border-orange-500/50 text-orange-400`;
      case 'skipped': return `${base} bg-[#0a0a0a] border-slate-800 text-slate-700 opacity-50`;
      default: return `${base} bg-[#252525] border-[#333] text-slate-500 hover:border-slate-500 hover:text-slate-300`;
    }
  };

  return (
    <div className={`min-h-screen font-sans pb-40 transition-colors duration-1000 ${recordingMode ? 'bg-[#1a0505]' : 'bg-[#121212]'}`}>
      
      {/* RECORDING OVERLAY */}
      <div className={`fixed inset-0 pointer-events-none z-[100] transition-opacity duration-500 ${recordingMode ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-0 w-full h-1 bg-red-500 shadow-[0_0_50px_red]"></div>
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 text-white font-bold px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div> REC
          </div>
      </div>

      {/* ORACLE */}
      {oracleMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur animate-in fade-in" onClick={() => setOracleMsg(null)}>
          <div className="bg-[#1a1a1a] border border-cyan-500/50 p-8 rounded-xl max-w-md text-center shadow-[0_0_50px_rgba(6,182,212,0.2)]">
            <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-slate-200 leading-relaxed tracking-wide">"{oracleMsg}"</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-b border-[#252525]">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
          <div className="flex justify-between items-center gap-2">
            
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-black text-slate-200 tracking-[0.2em] uppercase flex items-center gap-2">
                <Activity className="text-cyan-500 w-5 h-5" /> EDPN
              </h1>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mt-0.5">
                <span>DELTA STUDIO</span>
                <span className="text-slate-700">|</span>
                <span className="text-red-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(sessionTime)}</span>
                <span className="text-slate-700">|</span>
                {user ? <span className="flex items-center gap-1 text-green-500"><Wifi className="w-3 h-3"/> ONLINE</span> : <span className="flex items-center gap-1 text-red-500"><WifiOff className="w-3 h-3"/> OFFLINE</span>}
              </div>
            </div>

            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <div className="flex justify-between text-[10px] font-mono text-cyan-500 mb-1">
                <span>PROGRESS</span>
                <span>{calculateProgress()}%</span>
              </div>
              <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 shadow-[0_0_10px_cyan]" style={{ width: `${calculateProgress()}%` }}></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={askOracle} className="p-2 rounded-full bg-[#1a1a1a] border border-[#333] hover:border-cyan-500/50 hover:text-cyan-400 text-slate-500 transition-colors" title="Strategy">
                <Sparkles className="w-4 h-4" />
               </button>
               <button 
                  onClick={() => setRecordingMode(!recordingMode)}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${recordingMode ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-[#1a1a1a] border-[#333] text-slate-600 hover:text-slate-300'}`}
                >
                  <Power className="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-6 space-y-4">
        
        {/* CONSUMPTION */}
        <div className="flex justify-end gap-2 mb-6">
           <button onClick={() => updateConsumption('coffee')} className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#1a1a1a] border border-[#252525] hover:border-orange-900/50 hover:bg-[#251a15] transition-colors group">
             <Coffee className="w-3.5 h-3.5 text-orange-400/70 group-hover:text-orange-400" />
             <span className="text-xs font-mono font-bold text-slate-400">{consumption.coffee}</span>
           </button>
           <button onClick={() => updateConsumption('snus')} className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#1a1a1a] border border-[#252525] hover:border-blue-900/50 hover:bg-[#151a25] transition-colors group">
             <div className="w-3.5 h-3.5 rounded-full border border-slate-500 group-hover:border-slate-300"></div>
             <span className="text-xs font-mono font-bold text-slate-400">{consumption.snus}</span>
           </button>
           <button onClick={copyReport} className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded bg-[#1a1a1a] border border-[#252525] hover:border-cyan-900/50 hover:text-cyan-400 text-slate-500 transition-colors">
             <Share2 className="w-3.5 h-3.5" />
             <span className="text-[10px] font-bold uppercase hidden sm:inline">{copyFeedback ? 'Kopiert!' : 'Rapport'}</span>
           </button>
        </div>

        {/* SONG LIST */}
        {songs.map((song) => {
          // Progress calculation per song (excluding skipped)
          const activeParts = Object.values(song.parts).filter(p => p !== 'skipped');
          const partsDone = activeParts.filter(p => p === 'done' || p === 'master').length;
          const totalActive = activeParts.length;
          const percent = totalActive > 0 ? Math.round((partsDone/totalActive)*100) : 0;

          return (
            <div key={song.id} className="bg-[#181818] rounded border border-[#252525] shadow-lg transition-all hover:border-[#333]">
              
              <div className="p-3 sm:p-4 flex items-center justify-between gap-4">
                <button 
                  onClick={() => updateSongField(song.id, 'isCollapsed', !song.isCollapsed)}
                  className="p-1.5 rounded hover:bg-[#222] text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {song.isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>

                <div className="flex-1">
                  <DigitalDisplay 
                    value={song.title} 
                    onChange={(val) => updateSongField(song.id, 'title', val)} 
                    placeholder="Låtnavn"
                    isCollapsed={song.isCollapsed}
                  />
                </div>

                {song.isCollapsed && (
                  <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-500">
                    <span className={percent === 100 ? 'text-cyan-400' : ''}>{percent}%</span>
                    <div className="w-20 h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-600" style={{width: `${percent}%`}}></div>
                    </div>
                  </div>
                )}
                
                {!song.isCollapsed && (
                  <div className="hidden lg:flex gap-2">
                    <div className="flex flex-col bg-[#111] px-3 py-1 rounded border border-[#222]">
                      <span className="text-[9px] text-slate-600 font-bold uppercase">BPM</span>
                      <input 
                        className="bg-transparent text-sm font-mono text-cyan-500 focus:outline-none w-12" 
                        value={song.bpm}
                        onChange={(e) => updateSongField(song.id, 'bpm', e.target.value)}
                        placeholder="---"
                      />
                    </div>
                    <div className="flex flex-col bg-[#111] px-3 py-1 rounded border border-[#222]">
                      <span className="text-[9px] text-slate-600 font-bold uppercase">Key</span>
                      <input 
                        className="bg-transparent text-sm font-mono text-cyan-500 focus:outline-none w-8" 
                        value={song.key}
                        onChange={(e) => updateSongField(song.id, 'key', e.target.value)}
                        placeholder="-"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!song.isCollapsed && (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-[#222] pt-4 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                    {TRACKS.map((track) => {
                      const Icon = track.icon;
                      const status = song.parts[track.key];
                      const label = getStatusLabel(track.key, status);
                      return (
                        <button
                          key={track.key}
                          onClick={() => cycleStatus(song, track.key)}
                          className={getButtonClass(status)}
                        >
                          <div className="flex items-center justify-between w-full mb-1"><LedLight status={status} /></div>
                          <Icon className={`w-4 h-4 mb-2 ${status === 'skipped' ? 'opacity-20' : 'opacity-80'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'skipped' && 'line-through decoration-slate-600'}`}>{label}</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase mt-1">{track.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                    <div className="flex gap-2">
                       <button onClick={() => { setExpandedSong(expandedSong === song.id ? null : song.id); setExpandedType('lyrics'); }} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${song.lyrics ? 'text-cyan-400 bg-cyan-900/10' : 'text-slate-500 hover:text-slate-300'}`}>
                         <AlignLeft className="w-3 h-3" /> Tekst
                       </button>
                       <button onClick={() => { setExpandedSong(expandedSong === song.id ? null : song.id); setExpandedType('notes'); }} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${song.notes ? 'text-yellow-500 bg-yellow-900/10' : 'text-slate-500 hover:text-slate-300'}`}>
                         <FileText className="w-3 h-3" /> Notater
                       </button>
                    </div>
                    <button onClick={() => deleteSong(song.id)} className="text-slate-700 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {expandedSong === song.id && (
                <div className="bg-[#111] border-t border-[#252525] p-4">
                   <div className="flex justify-between items-center mb-3">
                     <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">{expandedType === 'lyrics' ? 'LYRICS / TEKST' : 'PRODUKSJONSNOTATER'}</span>
                     <button onClick={() => setExpandedSong(null)}><X className="w-4 h-4 text-slate-500 hover:text-white"/></button>
                   </div>
                   <textarea
                    value={expandedType === 'lyrics' ? song.lyrics : song.notes}
                    onChange={(e) => updateSongField(song.id, expandedType === 'lyrics' ? 'lyrics' : 'notes', e.target.value)}
                    className={`w-full bg-[#181818] text-slate-300 border border-[#333] p-4 font-mono text-sm leading-relaxed focus:outline-none focus:border-cyan-500/50 rounded min-h-[200px] ${expandedType === 'lyrics' ? 'text-center' : ''}`}
                    placeholder={expandedType === 'lyrics' ? "Lim inn tekst..." : "Skriv notater..."}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ADD SONG FORM */}
        <form onSubmit={addSong} className="mt-8">
          <div className="relative group max-w-md mx-auto">
            <input
              type="text"
              value={newSongTitle}
              onChange={(e) => setNewSongTitle(e.target.value)}
              placeholder="NYTT SPOR..."
              className="w-full bg-[#181818] border border-[#333] rounded px-6 py-3 text-slate-300 focus:outline-none focus:border-cyan-500 font-bold uppercase tracking-widest text-center transition-all"
            />
            <button type="submit" className="absolute right-2 top-2 p-1.5 bg-cyan-600 rounded text-black hover:bg-cyan-400 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="text-center pt-8 pb-4 opacity-30">
            <p className="text-[10px] font-mono tracking-[0.3em] text-slate-500">DELTA STUDIO CLOUD SYNC</p>
        </div>

      </main>
    </div>
  );
}
