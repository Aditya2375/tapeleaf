package tapeleaf;
import java.util.*;
public final class TestRunner{
 static long n=0;static void ck(boolean ok){n++;if(!ok)throw new AssertionError("check"+n);}static void eq(double a,double b){ck(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)));}
 public static void main(String[]args){ck(Engine.nextPrice(100,-29)==100);ck(Engine.nextPrice(101,-1)==100);ck(Engine.nextPrice(100,1)==101);ck(Engine.nextPrice(129,-29)==100);
  for(long seed:new long[]{1,2,2026,2147483648L,4294967295L})for(String mode:new String[]{"mixed","trend","quiet"}){var a=Engine.generate(seed,mode);ck(a.equals(Engine.generate(seed,mode)));
   for(int j=0;j<6;j++)for(int c=1;c<=120;c++)for(int w:new int[]{5,10,20}){var s=Engine.snapshot(a,j,c,w);var ts=a.get(j);long vol=0,pv=0;int hi=-1,lo=Integer.MAX_VALUE;for(int i=0;i<c;i++){var t=ts.get(i);ck(t.tick()==i+1&&t.price()>=100&&t.bid()<t.price()&&t.ask()>t.price()&&t.size()>0);vol+=t.size();pv+=(long)t.price()*t.size();hi=Math.max(hi,t.price());lo=Math.min(lo,t.price());}
    ck(s.volume()==vol&&s.notional()==pv&&s.high()==hi&&s.low()==lo);eq(s.vwap(),(double)pv/vol);eq(s.vwapPath().get(c-1),s.vwap());ck(s.vwap()>=lo&&s.vwap()<=hi);ck(s.last()==ts.get(c-1).price());eq(s.change(),100.0*(s.last()-s.prior())/s.prior());ck(s.trades().size()==Math.min(c,10));ck(s.trades().get(0).tick()==c);ck(s.bars().size()==(c+w-1)/w);ck(s.bars().get(s.bars().size()-1).complete()==(c%w==0));
    long v=0;for(var b:s.bars()){ck(b.start()<=b.end()&&b.end()<=c&&b.high()>=b.open()&&b.high()>=b.close()&&b.low()<=b.open()&&b.low()<=b.close());v+=b.volume();}ck(v==vol);if(mode.equals("quiet")){ck(s.last()==s.prior());eq(s.change(),0);eq(s.vwap(),s.prior());}
   }
  }
  for(long bad:new long[]{0,-1,4294967296L})try{Engine.generate(bad,"mixed");throw new AssertionError();}catch(IllegalArgumentException e){n++;}
  try{Engine.generate(1,"bad");throw new AssertionError();}catch(IllegalArgumentException e){n++;}
  var q=Engine.generate(1,"quiet");for(int[] x:new int[][]{{-1,1,5},{6,1,5},{0,0,5},{0,121,5},{0,1,1}})try{Engine.snapshot(q,x[0],x[1],x[2]);throw new AssertionError();}catch(IllegalArgumentException e){n++;}
  var fixture=Engine.generate(1,"quiet");fixture.get(0).set(0,new Engine.Tick(1,100,1,99,101));fixture.get(0).set(1,new Engine.Tick(2,300,2,299,301));fixture.get(0).set(2,new Engine.Tick(3,200,3,199,201));var f=Engine.snapshot(fixture,0,3,5);eq(f.vwap(),1300.0/6);ck(f.volume()==6&&f.notional()==1300);var b=f.bars().get(0);ck(b.open()==100&&b.high()==300&&b.low()==100&&b.close()==200&&!b.complete());eq(f.spreadBps(),100);
  System.out.println(n+" Java assertions passed");
 }
}
