import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei/core/Line.js";
import { OrbitControls } from "@react-three/drei/core/OrbitControls.js";
import { depthPlotGeometry, rectIsVisible } from "./sceneData";

function Plot({plot,metric}) {
  const {groups}=useMemo(()=>depthPlotGeometry(plot,metric.lines),[plot,metric]);
  return <group>
    <mesh position={[0,-1.05,-.15]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[8,3]}/><meshStandardMaterial color="#214f51" roughness={.5} metalness={.2} transparent opacity={.35}/></mesh>
    <gridHelper args={[8,8,"#578c87","#37625e"]} position={[0,-1.03,0]}/>
    {groups.map(({key,line,chains})=><group key={key}>{chains.map((chain,index)=><group key={index}>
      {chain.length>1&&<Line points={chain} color={line.color} lineWidth={3}/>}
      {chain.map((point,i)=><group key={i}><mesh position={point}><sphereGeometry args={[.05,12,8]}/><meshStandardMaterial color={line.color} emissive={line.color} emissiveIntensity={.4}/></mesh><Line points={[[point[0],-1,point[2]],point]} color={line.color} transparent opacity={.18} lineWidth={7}/></group>)}
    </group>)}</group>)}
  </group>;
}

function DepthLifecycle({onFailure}) {
  const gl=useThree(state=>state.gl);
  useEffect(()=>{
    const lost=event=>{event.preventDefault();onFailure?.();};
    gl.domElement.addEventListener("webglcontextlost",lost);
    return()=>gl.domElement.removeEventListener("webglcontextlost",lost);
  },[gl,onFailure]);
  return null;
}

export default function ChartDepthCanvas({plot,metric,onFailure}) {
  const host=useRef(); const controls=useRef(); const [inView,setInView]=useState(false);
  const [visible,setVisible]=useState(()=>!document.hidden);
  useEffect(()=>{
    const measure=()=>setInView(rectIsVisible(host.current?.getBoundingClientRect(),window.innerWidth,window.innerHeight));
    const visibility=()=>{setVisible(!document.hidden);measure();};
    const observer=typeof IntersectionObserver!=="undefined" ? new IntersectionObserver(([entry])=>setInView(entry.isIntersecting)) : null;
    if(observer) observer.observe(host.current);
    else window.addEventListener("scroll",measure,{passive:true,capture:true});
    measure();
    window.addEventListener("resize",measure);
    document.addEventListener("visibilitychange",visibility);
    return()=>{observer?.disconnect();window.removeEventListener("scroll",measure,true);window.removeEventListener("resize",measure);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  const zoom=direction=>{const instance=controls.current;if(!instance)return;instance.object.position.setLength(Math.min(12,Math.max(3.8,instance.object.position.length()*direction)));instance.update();};
  return <div ref={host} className="chart-depth-canvas" style={{height:300,position:"relative",borderRadius:20,overflow:"hidden",background:"var(--care-soft,#eef7f3)"}}>
    <div style={{position:"absolute",right:12,top:12,zIndex:1,display:"flex",gap:6}}><button type="button" onClick={()=>zoom(.85)} aria-label="Phóng to biểu đồ 3D">+</button><button type="button" onClick={()=>zoom(1.15)} aria-label="Thu nhỏ biểu đồ 3D">−</button></div>
    <Canvas aria-hidden="true" frameloop={inView&&visible?"demand":"never"} dpr={[1,1.5]} camera={{position:[.5,2,7],fov:48}} gl={{alpha:true,antialias:true,powerPreference:"low-power"}}><ambientLight intensity={1.5}/><directionalLight position={[2,4,4]} intensity={2}/><Plot plot={plot} metric={metric}/><OrbitControls ref={controls} enablePan={false} enableZoom={false} minPolarAngle={.65} maxPolarAngle={1.55} minAzimuthAngle={-.5} maxAzimuthAngle={.5} enableDamping={false}/><DepthLifecycle onFailure={onFailure}/></Canvas>
  </div>;
}
