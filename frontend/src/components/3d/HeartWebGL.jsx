import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei/core/Environment.js";
import { Lightformer } from "@react-three/drei/core/Lightformer.js";
import * as THREE from "three";
import { heartTone, heartbeatScaleAt } from "./sceneData";

export function HeartModel({ bpm, status, busy, pointer, active }) {
  const model = useRef();
  const orbit = useRef();
  const particles = useRef();
  const invalidate = useThree(state => state.invalidate);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0,.4); shape.bezierCurveTo(0,1,-1,1,-1,.25); shape.bezierCurveTo(-1,-.25,0,-.9,0,-1.2); shape.bezierCurveTo(0,-.9,1,-.25,1,.25); shape.bezierCurveTo(1,1,0,1,0,.4);
    const result = new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.12,bevelThickness:.14,curveSegments:10});
    result.center(); return result;
  }, []);
  const ecg = useMemo(() => {
    const points=[[-.65,0,.42],[-.35,0,.42],[-.22,.2,.42],[-.06,-.32,.42],[.12,.28,.42],[.27,0,.42],[.65,0,.42]].map(p=>new THREE.Vector3(...p));
    const path=new THREE.CurvePath(); points.slice(1).forEach((point,index)=>path.add(new THREE.LineCurve3(points[index],point)));
    return new THREE.TubeGeometry(path,32,.025,5,false);
  }, []);
  const stars = useMemo(() => {
    const points=new Float32Array(24*3);
    for(let i=0;i<24;i++){const angle=i*2.39996; const radius=1.55+(i%4)*.18; points[i*3]=Math.cos(angle)*radius; points[i*3+1]=Math.sin(angle)*radius*.8; points[i*3+2]=Math.sin(i*7)*.8;}
    return points;
  }, []);
  const tone = heartTone(status);
  useEffect(() => { invalidate(); }, [active,bpm,status,busy,invalidate]);
  useEffect(() => () => { geometry.dispose(); ecg.dispose(); }, [geometry,ecg]);
  useFrame(({clock}, delta) => {
    if(!active || !model.current) return;
    const elapsed=clock.elapsedTime;
    model.current.scale.setScalar(heartbeatScaleAt(elapsed, bpm));
    model.current.rotation.y=THREE.MathUtils.damp(model.current.rotation.y, -.27+(pointer?.current.x || 0)*.38+Math.sin(elapsed*(busy ? 1.4 : .2))*.1,5,delta);
    model.current.rotation.x=THREE.MathUtils.damp(model.current.rotation.x, -.08+(pointer?.current.y || 0)*.25,5,delta);
    if(orbit.current) orbit.current.position.set(Math.cos(elapsed*(busy ? 1.2 : .32))*1.73,Math.sin(elapsed*(busy ? 1.2 : .32))*.88,Math.sin(elapsed*.32)*.7);
    if(particles.current) particles.current.rotation.z=elapsed*.025;
    invalidate();
  });
  return <group>
    <group ref={model} rotation={[-.08,-.27,-.06]}>
      <mesh geometry={geometry}><meshPhysicalMaterial color={tone} roughness={.15} metalness={.18} clearcoat={1} clearcoatRoughness={.12} transmission={.24} thickness={.8} iridescence={.22} envMapIntensity={1.5}/></mesh>
      <mesh geometry={ecg}><meshStandardMaterial color="#edfffb" emissive="#baffed" emissiveIntensity={.35} roughness={.2}/></mesh>
    </group>
    <mesh rotation={[.5,.1,-.42]}><torusGeometry args={[1.75,.008,6,96]}/><meshBasicMaterial color={tone} transparent opacity={.38}/></mesh>
    <mesh rotation={[1.1,.1,.5]}><torusGeometry args={[1.9,.004,4,80]}/><meshBasicMaterial color="#b7f4e8" transparent opacity={.18}/></mesh>
    <mesh ref={orbit}><sphereGeometry args={[.035,10,8]}/><meshBasicMaterial color="#b9ffea"/></mesh>
    <points ref={particles}><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars,3]}/></bufferGeometry><pointsMaterial color={tone} size={.022} transparent opacity={.6} sizeAttenuation/></points>
  </group>;
}

function CanvasLifecycle({ onReady, onFailure }) {
  const gl = useThree(state=>state.gl);
  useEffect(() => {
    onReady?.();
    const lost=event=>{event.preventDefault();onFailure?.();};
    gl.domElement.addEventListener("webglcontextlost",lost);
    return ()=>gl.domElement.removeEventListener("webglcontextlost",lost);
  },[gl,onReady,onFailure]);
  return null;
}

export default function HeartWebGL({active,onReady,onFailure,...props}) {
  return <Canvas dpr={[1,1.5]} frameloop={active ? "demand" : "never"} camera={{position:[0,0,5.5],fov:43}} gl={{alpha:true,antialias:true,powerPreference:"low-power"}}>
    <ambientLight intensity={.8}/><directionalLight position={[3,4,5]} intensity={2.5}/><pointLight position={[-3,-1,2]} intensity={7} color="#5eead4"/>
    <Environment resolution={64} frames={1}><Lightformer intensity={3} position={[0,3,3]} scale={[4,2,1]}/><Lightformer intensity={2} color="#79dfd4" position={[-3,0,2]} scale={[2,4,1]}/></Environment>
    <HeartModel {...props} active={active}/><CanvasLifecycle onReady={onReady} onFailure={onFailure}/>
  </Canvas>;
}
