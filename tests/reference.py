"""Independent Python integer generator and slice-based aggregation vs Java outputs. No third-party packages."""
import subprocess,json,math
N=0
BASE=[4800,7300,12500,3200,9100,15600]
def check(a,b):
 global N
 N+=1
 if isinstance(a,(int,float)) and not isinstance(a,bool):assert math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12),(a,b)
 else:assert a==b,(a,b)
for seed in [1,2,2026,2147483648,4294967295]:
 for mode in ['mixed','trend','quiet']:
  out=json.loads(subprocess.check_output(['java','-cp','build/classes','Dump',str(seed),mode]));state=seed;a=[[]for _ in BASE];p=BASE.copy()
  def rng():
   global state
   for direction,bits in [('l',13),('r',17),('l',5)]:state=(state ^ ((state<<bits) if direction=='l' else (state>>bits))) & 0xffffffff
   return state
  for i in range(1,121):
   for j in range(6):
    raw=rng()%41-20;p[j]+=0 if mode=='quiet' else raw+((9 if j%2==0 else -9)if mode=='trend' else 0);p[j]=max(100,p[j]);h=1+rng()%8;v=10*(1+rng()%100);a[j].append(dict(tick=i,price=p[j],size=v,bid=p[j]-h,ask=p[j]+h))
  check(a,out[0]);ix=1
  for j in range(6):
   for c in [1,5,6,10,11,59,60,119,120]:
    for w in [5,10,20]:
     ts=a[j][:c];s=out[ix];ix+=1;v=sum(t['size']for t in ts);pv=sum(t['price']*t['size']for t in ts);last=ts[-1];ps=[t['price']for t in ts]
     expected=dict(prior=BASE[j],last=last['price'],bid=last['bid'],ask=last['ask'],high=max(ps),low=min(ps),volume=v,notional=pv,vwap=pv/v,change=100*(last['price']/BASE[j]-1),spreadBps=20000*(last['ask']-last['bid'])/(last['ask']+last['bid']))
     for k,val in expected.items():check(s[k],val)
     for end in range(1,c+1):check(s['vwapPath'][end-1],sum(t['price']*t['size']for t in ts[:end])/sum(t['size']for t in ts[:end]))
     for i,b in zip(range(0,c,w),s['bars']):
      z=ts[i:i+w];expected=dict(start=i+1,end=i+len(z),open=z[0]['price'],high=max(t['price']for t in z),low=min(t['price']for t in z),close=z[-1]['price'],volume=sum(t['size']for t in z),complete=len(z)==w);check(b,expected)
     check(s['trades'],list(reversed(ts[-10:])))
print(N,'independent Python integer/price-volume/OHLCV/prefix VWAP checks passed')
