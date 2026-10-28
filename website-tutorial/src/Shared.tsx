import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {NarrationAudio} from './NarrationAudio';
loadFont({family:'Khmer',url:staticFile('fonts/KantumruyPro.ttf')});
export const ink='#132b2b', teal='#087f71', gold='#d4ad60';
export const Button=({children}:{children:React.ReactNode})=><div style={{background:teal,color:'white',padding:'17px 28px',borderRadius:13,fontSize:29,fontWeight:650,display:'inline-block'}}>{children} ↗</div>;
export const Field=({label,value}:{label:string;value:string})=><div style={{marginBottom:22}}><div style={{fontSize:25,color:'#637977',marginBottom:9}}>{label}</div><div style={{padding:'17px 20px',border:'1px solid #cfddda',borderRadius:10,fontSize:29,background:'#fafcfc',whiteSpace:'pre-line'}}>{value}</div></div>;
export const Tag=({children}:{children:React.ReactNode})=><span style={{display:'inline-block',background:'#e1f2eb',color:teal,padding:'9px 17px',borderRadius:30,fontSize:26,marginRight:12}}>{children}</span>;
export const Panel=({title,children}:{title:string;children:React.ReactNode})=><div style={{background:'white',border:'1px solid #e0e8e5',borderRadius:23,padding:36,boxShadow:'0 22px 60px #173f3810'}}><div style={{fontSize:34,fontWeight:650,marginBottom:25}}>{title}</div>{children}</div>;
export const Frame=({step,title,kicker,items,tip,voiceover,children}:{step:string;title:string;kicker:string;items:string[];tip:string;voiceover:string;children:React.ReactNode})=>{
 const frame=useCurrentFrame();const {fps,durationInFrames}=useVideoConfig();
 return <AbsoluteFill style={{background:'#f3f6f1',fontFamily:'Khmer, sans-serif',color:ink,padding:'66px 90px'}}>
  <NarrationAudio stepId={voiceover}/>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:27}}><div style={{fontWeight:750,fontSize:37}}>▱ workday<span style={{color:teal}}>.</span></div><div style={{color:'#59706c'}}>សៀវភៅណែនាំជាវីដេអូ <span style={{marginLeft:28,color:teal}}>KH / {step}</span></div></div>
  <div style={{display:'flex',gap:60,marginTop:65,opacity:interpolate(frame,[0,.65*fps],[0,1],{extrapolateRight:'clamp'}),translate:`0 ${interpolate(frame,[0,.7*fps],[24,0],{extrapolateRight:'clamp'})}px`}}>
   <div style={{width:610,flexShrink:0}}><div style={{color:teal,fontSize:25,letterSpacing:2,fontWeight:650}}>{kicker}</div><h1 style={{fontSize:64,lineHeight:1.5,fontWeight:700,margin:'18px 0 34px'}}>{title}</h1><div style={{display:'grid',gap:27}}>{items.map((item,i)=><div key={item} style={{display:'flex',gap:18,fontSize:32,lineHeight:1.65,opacity:interpolate(frame,[(.6+i*.8)*fps,(1+i*.8)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{color:teal,fontWeight:700}}>{String(i+1).padStart(2,'0')}</span><span>{item}</span></div>)}</div><div style={{borderLeft:`4px solid ${gold}`,paddingLeft:22,fontSize:26,lineHeight:1.7,color:'#64746d',marginTop:38}}>{tip}</div></div>
   <div style={{width:1070,paddingTop:8}}><div style={{height:40,background:'#e1e9e4',borderRadius:'18px 18px 0 0',display:'flex',alignItems:'center',gap:7,paddingLeft:20}}><span style={{color:'#98aaa1'}}>● ● ●</span><span style={{fontSize:18,marginLeft:22,color:'#63776d'}}>weekly-tau-bay.vercel.app</span></div><div style={{padding:26,background:'#edf2ee',borderRadius:'0 0 20px 20px',minHeight:560}}>{children}</div><div style={{fontSize:20,color:'#819087',textAlign:'right',marginTop:15}}>រូបភាពគំរូសម្រាប់ពន្យល់ • ទិន្នន័យឧទាហរណ៍</div></div>
  </div>
  <div style={{position:'absolute',bottom:53,left:90,right:90,display:'flex',justifyContent:'space-between',fontSize:22,color:'#6c8077'}}><span>Employee Task Management & Daily Reporting</span><span>ចូលគណនី → ការងារ → របាយការណ៍ → ពិនិត្យ</span></div>
  <div style={{position:'absolute',bottom:0,left:0,height:7,width:`${interpolate(frame,[0,durationInFrames],[0,100])}%`,background:teal}}/>
 </AbsoluteFill>;
};
