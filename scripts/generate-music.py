"""Generate the local pond soundtrack through ComfyUI, then close its loop."""
import json
import time
import urllib.request
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8188'
def request(path, data=None):
    body = json.dumps(data).encode() if data is not None else None
    with urllib.request.urlopen(urllib.request.Request(BASE + path, data=body, headers={'Content-Type':'application/json'}), timeout=60) as response:
        return json.load(response)

tags = 'Instrumental Japanese zen garden ambient, deeply relaxing, sparse soft felt piano, delicate koto plucks, warm sustained airy pads, very gentle distant bamboo flute, spacious natural reverb, peaceful koi pond at dawn, slow breathing pace, D major pentatonic, low dynamics, continuous meditative texture, no vocals, no singing, no drums, no percussion beats, no dramatic buildup, no climax, no ending flourish, seamless background music'
graph = {
 '1': {'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':'ace_step_1.5_turbo_aio.safetensors'}},
 '2': {'class_type':'TextEncodeAceStepAudio1.5','inputs':{'clip':['1',1],'tags':tags,'lyrics':'[Instrumental]','seed':26101217,'bpm':60,'duration':80,'timesignature':'4','language':'en','keyscale':'D major','generate_audio_codes':True,'cfg_scale':2.0,'temperature':.78,'top_p':.9,'top_k':0,'min_p':0.0}},
 '3': {'class_type':'EmptyAceStep1.5LatentAudio','inputs':{'seconds':80,'batch_size':1}},
 '4': {'class_type':'KSampler','inputs':{'model':['8',0],'seed':26101217,'steps':8,'cfg':1.0,'sampler_name':'euler','scheduler':'simple','positive':['2',0],'negative':['7',0],'latent_image':['3',0],'denoise':1.0}},
 '5': {'class_type':'VAEDecodeAudio','inputs':{'samples':['4',0],'vae':['1',2]}},
 '6': {'class_type':'SaveAudio','inputs':{'audio':['5',0],'filename_prefix':'kin/quiet-pond'}},
 '7': {'class_type':'ConditioningZeroOut','inputs':{'conditioning':['2',0]}},
 '8': {'class_type':'ModelSamplingAuraFlow','inputs':{'model':['1',0],'shift':3.0}},
}
pid = request('/prompt', {'prompt':graph,'client_id':'kin-local-music'})['prompt_id']
print('ComfyUI prompt:',pid,flush=True)
deadline=time.monotonic()+1800
while time.monotonic()<deadline:
    history=request('/history/'+pid)
    if pid in history:
        result=history[pid]
        if result['status']['status_str']!='success':raise RuntimeError(result['status'])
        output=result['outputs']['6']['audio'][0]
        break
    time.sleep(3)
else:raise TimeoutError(pid)
from urllib.parse import urlencode
source=ROOT/'assets'/'quiet-pond-original.flac'
urllib.request.urlretrieve(BASE+'/view?'+urlencode(output),source)
destination=ROOT/'public'/'audio'/'quiet-pond.mp3'
destination.parent.mkdir(parents=True,exist_ok=True)
# Join the last six seconds to the first six, then loop at matching sample positions.
filters='[0:a]atrim=start=4:end=76,asetpts=PTS-STARTPTS,asplit=3[h][m][t];[h]atrim=end=6,asetpts=PTS-STARTPTS[head];[m]atrim=start=6:end=66,asetpts=PTS-STARTPTS[mid];[t]atrim=start=66,asetpts=PTS-STARTPTS[tail];[tail][head]acrossfade=d=6:c1=tri:c2=tri[join];[mid][join]concat=n=2:v=0:a=1,volume=0.85[out]'
subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-filter_complex',filters,'-map','[out]','-ar','44100','-c:a','libmp3lame','-q:a','2',str(destination)],check=True)
print('Soundtrack saved:',destination,flush=True)
