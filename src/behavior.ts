import { Vector2 } from 'three';
export type FishState = 'wander' | 'idle' | 'food' | 'startle' | 'recovery' | 'curious';
export interface Attractor { position: Vector2; active: boolean }
export class FishAgent {
  position = new Vector2(); velocity = new Vector2(); direction: number; turn = 0;
  state: FishState = 'wander'; timer = 0; clock: number; baseSpeed: number; agility: number; vigilance: number;
  size: number; seed: number; flee = new Vector2(); target: Attractor | null = null;
  wanderTarget=new Vector2();wanderTime=0;angularVelocity=0;route=0;
  constructor(public id: number, public variety: number, rx:number, ry:number, random=Math.random) {
    this.seed=random(); this.size=.65+random()*.5; this.baseSpeed=.5+random()*.4; this.agility=.5+random()*.45; this.vigilance=.6+random()*.9; this.clock=random()*40;
    const angle=random()*Math.PI*2, r=Math.sqrt(random())*.72; this.position.set(Math.cos(angle)*rx*r,Math.sin(angle)*ry*r); this.direction=random()*Math.PI*2;
    this.velocity.set(Math.cos(this.direction),Math.sin(this.direction)).multiplyScalar(this.baseSpeed);
  }
  scare(point:Vector2, strength:number) {
    if(this.position.distanceToSquared(point)<Math.pow(2.6*this.vigilance,2)) {this.flee.copy(this.position).sub(point).normalize().multiplyScalar(strength); this.state='startle';this.timer=1.2+this.seed;}
  }
}
const force=new Vector2(), delta=new Vector2(), align=new Vector2(), center=new Vector2();
export class FishBehaviorSystem {
  agents:FishAgent[]=[]; rx=13;ry=9; curiosity: Vector2 | null=null;
  setBounds(rx:number,ry:number) {this.rx=rx;this.ry=ry;}
  setCount(count:number) { while(this.agents.length<count) {const i=this.agents.length;let candidate=new FishAgent(i,(i+5)%6,this.rx,this.ry);for(let attempt=0;attempt<40;attempt++){if(this.agents.every(a=>a.position.distanceTo(candidate.position)>(a.size+candidate.size)*1.25))break;candidate=new FishAgent(i,(i+5)%6,this.rx,this.ry);}if(i===0){candidate.variety=6;candidate.seed=.888168;candidate.size=1.38;candidate.baseSpeed=.54;candidate.agility=.56;candidate.vigilance=.7;candidate.position.set(0,.8);candidate.direction=.24;candidate.velocity.set(Math.cos(.24),Math.sin(.24)).multiplyScalar(.54);}this.agents.push(candidate);} this.agents.length=count; }
  update(dt:number,speed:number,food:Attractor[]) {
    // Steering is integrated in bounded substeps by the scene controller.
    for(const a of this.agents) {
      a.clock+=dt; a.timer-=dt; a.target=null;
      if(a.state==='startle'&&a.timer<=0){a.state='recovery';a.timer=2.5;}
      if(a.state==='recovery'&&a.timer<=0)a.state='wander';
      if(a.state!=='startle'&&a.state!=='recovery') {
        let nearest=64;
        for(const f of food) if(f.active){const d=a.position.distanceToSquared(f.position);if(d<nearest){nearest=d;a.target=f;}}
        if(a.target) a.state='food';
        else if(this.curiosity&&a.position.distanceToSquared(this.curiosity)<64&&a.seed>.3)a.state='curious';
        else a.state=Math.sin(a.clock*.19+a.seed*9)>.91?'idle':'wander';
      }
      a.wanderTime-=dt;
      if(a.wanderTime<=0||a.position.distanceToSquared(a.wanderTarget)<2.25){
        a.route++;const variation=Math.sin(a.route*2.399+a.seed*19);
        const heading=a.direction+variation*.8;const distance=5+a.seed*5;
        a.wanderTarget.set(a.position.x+Math.cos(heading)*distance,a.position.y+Math.sin(heading)*distance);
        const edge=Math.hypot(a.wanderTarget.x/(this.rx*.72),a.wanderTarget.y/(this.ry*.72));if(edge>1)a.wanderTarget.multiplyScalar(1/edge);
        a.wanderTime=6+a.seed*7;
      }
      force.copy(a.wanderTarget).sub(a.position).normalize().multiplyScalar(1.4);
      if(a.state==='startle')force.copy(a.flee).multiplyScalar(4);
      if(a.state==='food'&&a.target)force.copy(a.target.position).sub(a.position).normalize().multiplyScalar(2.6);
      if(a.state==='curious'&&this.curiosity){delta.copy(this.curiosity).sub(a.position);if(delta.length()>1.2)force.copy(delta).normalize().multiplyScalar(1.6);}
      align.set(0,0);center.set(0,0);let neighbors=0;
      for(const b of this.agents)if(a!==b){
        delta.copy(a.position).sub(b.position);const d=delta.length();
        const spacing=(a.size+b.size)*.85;
        if(d<spacing&&d>.001)force.addScaledVector(delta,(spacing-d)/(d*spacing)*3.5);
        if(d<3.4){align.add(b.velocity);center.add(b.position);neighbors++;}
      }
      if(neighbors&&a.state==='wander'){force.addScaledVector(align.normalize(),.12);center.multiplyScalar(1/neighbors).sub(a.position);force.addScaledVector(center,.025);}
      const bx=this.rx-a.size*1.6, by=this.ry-a.size*1.6;
      const edge=Math.hypot(a.position.x/bx,a.position.y/by);
      if(edge>.68){delta.set(-a.position.x/(bx*bx),-a.position.y/(by*by)).normalize();force.addScaledVector(delta,Math.pow((edge-.68)/.32,2)*7);}
      const wanted=Math.atan2(force.y,force.x);const diff=Math.atan2(Math.sin(wanted-a.direction),Math.cos(wanted-a.direction));
      const maxTurn=a.agility*(a.state==='startle'?2.8:a.state==='food'?1.5:1);
      const desiredTurn=Math.max(-maxTurn,Math.min(maxTurn,diff*1.25));
      a.angularVelocity+=(desiredTurn-a.angularVelocity)*(1-Math.exp(-dt*(a.state==='startle'?5:2.1)));
      a.direction+=a.angularVelocity*dt;a.turn=a.angularVelocity;
      let targetSpeed=a.baseSpeed*speed*(a.state==='startle'?3.1:a.state==='recovery'?1.5:a.state==='food'?1.45:a.state==='idle'?.28:1);
      if(a.state==='food'&&a.target&&a.position.distanceToSquared(a.target.position)<1)targetSpeed*=.5;
      targetSpeed*=1-Math.min(.35,Math.abs(a.angularVelocity)*.2);
      targetSpeed*=.94+.06*Math.sin(a.clock*.8+a.seed*11);
      const current=a.velocity.length(), actual=current+(targetSpeed-current)*(1-Math.exp(-dt*(a.state==='startle'?3:.9)));
      a.velocity.set(Math.cos(a.direction)*actual,Math.sin(a.direction)*actual);a.position.addScaledVector(a.velocity,dt);
      const limit=Math.hypot(a.position.x/bx,a.position.y/by);
      if(limit>1){a.position.multiplyScalar(1/limit);}
    }
  }
}
