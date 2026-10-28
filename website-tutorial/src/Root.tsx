import {Composition,Folder,Series,useVideoConfig} from 'remotion';
import {Opening} from './Opening';
import {Login} from './Login';
import {Tasks} from './Tasks';
import {Report} from './Report';
import {Evidence} from './Evidence';
import {Submit} from './Submit';
import {Review} from './Review';
import {Manage} from './Manage';
import {Closing} from './Closing';
import {durationInFrames, stepFrames} from './narration';
import {NarrationContext, defaultNarrationOptions, type NarrationOptions} from './NarrationAudio';
export type TutorialProps = {narrationOptions?: NarrationOptions};
export const Tutorial=({narrationOptions=defaultNarrationOptions}:TutorialProps)=>{const {fps}=useVideoConfig();return <NarrationContext.Provider value={narrationOptions}><Series>
 <Series.Sequence name="Welcome" durationInFrames={stepFrames(0)} premountFor={fps}><Opening/></Series.Sequence>
 <Series.Sequence name="Sign in" durationInFrames={stepFrames(1)} premountFor={fps}><Login/></Series.Sequence>
 <Series.Sequence
  name="Accept and start work"
  durationInFrames={stepFrames(2)}
  premountFor={fps}
 ><Tasks/></Series.Sequence>
 <Series.Sequence name="Create daily report" durationInFrames={stepFrames(3)} premountFor={fps}><Report/></Series.Sequence>
 <Series.Sequence name="Links and Digital role" durationInFrames={stepFrames(4)} premountFor={fps}><Evidence/></Series.Sequence>
 <Series.Sequence name="Draft and submission" durationInFrames={stepFrames(5)} premountFor={fps}><Submit/></Series.Sequence>
 <Series.Sequence name="Manager review and revisions" durationInFrames={stepFrames(6)} premountFor={fps}><Review/></Series.Sequence>
 <Series.Sequence name="Assign and complete tasks" durationInFrames={stepFrames(7)} premountFor={fps}><Manage/></Series.Sequence>
 <Series.Sequence name="Notifications and exports" durationInFrames={stepFrames(8)} premountFor={fps}><Closing/></Series.Sequence>
</Series></NarrationContext.Provider>};
export const RemotionRoot=()=> <>
 <Composition id="Workday-Khmer-Guide" component={Tutorial} width={1920} height={1080} fps={30} durationInFrames={durationInFrames}/>
 <Folder name="Chapters">
 <Composition id="Welcome" component={Opening} width={1920} height={1080} fps={30} durationInFrames={300}/>
 <Composition id="Sign-in" component={Login} width={1920} height={1080} fps={30} durationInFrames={480}/>
 <Composition id="Tasks" component={Tasks} width={1920} height={1080} fps={30} durationInFrames={600}/>
 <Composition id="Daily-report" component={Report} width={1920} height={1080} fps={30} durationInFrames={600}/>
 <Composition id="Evidence" component={Evidence} width={1920} height={1080} fps={30} durationInFrames={600}/>
 <Composition id="Submit" component={Submit} width={1920} height={1080} fps={30} durationInFrames={540}/>
 <Composition id="Review" component={Review} width={1920} height={1080} fps={30} durationInFrames={600}/>
 <Composition id="Manage" component={Manage} width={1920} height={1080} fps={30} durationInFrames={600}/>
 <Composition id="Closing" component={Closing} width={1920} height={1080} fps={30} durationInFrames={480}/>
 </Folder>
</>;
