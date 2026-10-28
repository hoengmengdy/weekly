import {useMemo} from 'react';
import {Player} from '@remotion/player';
import {Tutorial} from './Root';
import {FPS as fps, durationInFrames, formatTime, narration} from './narration';
import {useNarrationControls} from './useNarrationControls';
import './viewer.css';

export const TutorialViewer=()=>{
 const control=useNarrationControls();
 const {playerRef,frame,currentStep,automatic,soundEnabled,playing,loading,error,
  playbackRate,setPlaybackRate,setSoundEnabled,toggleAutomatic,audible}=control;
 const totalTime=formatTime(durationInFrames);
 const inputProps=useMemo(()=>({narrationOptions:control.narrationOptions}),[control.narrationOptions]);
 return <main className="tutorial-shell">
  <header className="tutorial-header">
   <div>
    <p className="eyebrow">WORKDAY · USER GUIDE</p>
    <h1>សៀវភៅណែនាំ Workday</h1>
    <p className="header-copy">មើលវីដេអូ និងស្តាប់ការណែនាំជាភាសាខ្មែរ តាមជំហាននីមួយៗ</p>
   </div>
   <div className="header-actions">
    <span className="duration-pill">{String(narration.length).padStart(2,'0')} ជំហាន · {totalTime}</span>
    <a className="download-button" href="/workday-khmer-guide.mp4" download="workday-khmer-guide.mp4">
     ⬇️ ទាញយកវីដេអូ
    </a>
   </div>
  </header>

  <section className="video-card" aria-label="វីដេអូណែនាំ">
   <Player
    ref={playerRef}
    component={Tutorial}
    durationInFrames={durationInFrames}
    compositionWidth={1920}
    compositionHeight={1080}
    fps={fps}
    initialFrame={0}
    controls
    inputProps={inputProps}
    outFrame={control.outFrame}
    moveToBeginningWhenEnded={false}
    initiallyMuted={false}
    initialVolume={1}
    playbackRate={playbackRate}
    preservePitch
    renderLoading={()=> <div className="player-message" role="status">កំពុងផ្ទុកវីដេអូ និងសំឡេងខ្មែរ…</div>}
    errorFallback={({error:playerError})=>
     <div className="player-message error-message" role="alert">
      មិនអាចចាក់វីដេអូ ឬសំឡេងបានទេ។ សូមផ្ទុកទំព័រឡើងវិញ។
      <span>{playerError.message}</span>
     </div>
    }
    style={{width:'100%',aspectRatio:'16 / 9'}}
   />
  </section>

  <section className="narration-panel" aria-label="ការគ្រប់គ្រងសំឡេងអាន">
   <div className="narration-status" aria-live="polite" data-step-id={currentStep.stepId} data-playing={playing} data-audible={audible} data-frame={frame}>
    <span className={`status-dot${audible&&playing&&control.speaking?' is-speaking':''}`} aria-hidden="true"/>
    <div>
     <p className="status-label">{audible&&playing&&control.speaking?'កំពុងអានជំហាន':'ជំហានសំឡេងបច្ចុប្បន្ន'}</p>
     <p className="status-step">{String(narration.indexOf(currentStep)+1).padStart(2,'0')} · {currentStep.label}</p>
    </div>
    <span className="time-readout">{formatTime(frame)} / {totalTime}</span>
   </div>

   <div className="voice-controls">
    <button type="button" className="control-button primary" aria-pressed={soundEnabled} onClick={()=>setSoundEnabled(true)}>
     🔊 បើកសំឡេងអាន
    </button>
    <button type="button" className="control-button" aria-pressed={!soundEnabled} onClick={()=>setSoundEnabled(false)}>
     🔇 បិទសំឡេង
    </button>
    <button type="button" className="control-button" disabled={control.unavailable.includes(currentStep.stepId)} onClick={(event)=>control.navigate(currentStep.stepId,event,true)}>
     ▶️ ស្តាប់ជំហាននេះ
    </button>
    <button type="button" className="control-button" onClick={(event)=>playing?playerRef.current?.pause():control.play(event)}>
     {playing?'⏸️ ផ្អាកសំឡេង':'▶️ បន្តសំឡេង'}
    </button>
    <button type="button" className="control-button" disabled={control.unavailable.includes(currentStep.stepId)} onClick={(event)=>control.navigate(currentStep.stepId,event,true)}>
     🔁 ស្តាប់ម្តងទៀត
    </button>
   </div>

   <div className="voice-options">
    <label className="automatic-toggle">
     <input
      type="checkbox"
      checked={automatic}
      onChange={(event)=>toggleAutomatic(event.currentTarget.checked)}
     />
     <span>☑️ ចាក់សំឡេងស្វ័យប្រវត្តិតាមជំហាន</span>
    </label>
    <label className="speed-control">
     <span>ល្បឿនសំឡេង និងវីដេអូ</span>
     <select
      value={playbackRate}
      onChange={(event)=>setPlaybackRate(Number(event.currentTarget.value))}
      aria-label="ជ្រើសល្បឿនសំឡេង"
     >
      <option value={0.8}>0.8x</option>
      <option value={1}>1.0x</option>
      <option value={1.2}>1.2x</option>
     </select>
    </label>
   </div>

   <p className="sync-note">ពេលផ្អាក ឬអូសវីដេអូ សំឡេងនឹងផ្អាក និងតាមទីតាំងវីដេអូ ដើម្បីរក្សាការស៊ីសង្វាក់។</p>
   <p className="sync-note">ប្រើឯកសារសំឡេងខ្មែរដែលបានបង្កើតរួច។ មិនចាំបាច់មានសំឡេងខ្មែរនៅក្នុង browser ទេ។</p>
   {control.unavailable.includes(currentStep.stepId)&&<p className="feedback-message error-message" role="alert">
    មិនអាចផ្ទុកឯកសារសំឡេងខ្មែរសម្រាប់ជំហាននេះបានទេ។ អ្នកនៅតែអាចមើលវីដេអូបាន។ សូមផ្ទុកទំព័រឡើងវិញដើម្បីសាកល្បងម្ដងទៀត។
   </p>}
   {(loading||control.checking.includes(currentStep.stepId))&&<p className="feedback-message" role="status">កំពុងផ្ទុកសំឡេងខ្មែរ…</p>}
   {(error)&&
    <p className={error?'feedback-message error-message':'feedback-message'} role={error?'alert':'status'}>
     {error?`មានបញ្ហាក្នុងការចាក់សំឡេងខ្មែរ៖ ${error}`:'កំពុងផ្ទុកសំឡេងខ្មែរ…'}
    </p>
   }
  </section>

  <nav className="step-list" aria-label="ជំហានក្នុងវីដេអូ">
   <h2>ជំហានណែនាំ</h2>
   <ol>
    {narration.map((step,index)=>{
     const active=step.stepId===currentStep.stepId;
     return <li key={step.stepId}>
      <button
       type="button"
       className={`step-button${active?' active-step':''}`}
       aria-current={active?'step':undefined}
       onClick={(event)=>control.navigate(step.stepId,event)}
      >
       <span className="step-number">{String(index+1).padStart(2,'0')}</span>
       <span className="step-label">{step.label}</span>
       <span className="step-time">{formatTime(step.startTime*fps)}</span>
      </button>
     </li>;
    })}
   </ol>
  </nav>
 </main>;
};
