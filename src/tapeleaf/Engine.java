package tapeleaf;
import java.util.*;
/** Deterministic invented trade/quote tape. Prices integer cents of fictitious units. */
public final class Engine {
 public static final String[] SYMBOLS={"ALFA","BRIO","COVE","DUNE","ELIO","FENN"};
 public static final int[] BASE={4800,7300,12500,3200,9100,15600};
 public static final int TICKS=120;
 static int nextPrice(int prior,int step){return Math.max(100,prior+step);}
 public record Tick(int tick,int price,int size,int bid,int ask){}
 public record Bar(int start,int end,int open,int high,int low,int close,long volume,boolean complete){}
 public record Snapshot(int prior,int last,int bid,int ask,int high,int low,long volume,long notional,double vwap,double change,double spreadBps,List<Double> vwapPath,List<Bar> bars,List<Tick> trades){}
 static final class Rng { long x;Rng(long seed){x=seed;}long next(){x^=(x<<13)&0xffffffffL;x^=x>>>17;x^=(x<<5)&0xffffffffL;x&=0xffffffffL;return x;} }
 public static List<List<Tick>> generate(long seed,String scenario){
  if(seed<1||seed>0xffffffffL||!Set.of("mixed","trend","quiet").contains(scenario))throw new IllegalArgumentException("Invalid generation inputs");
  Rng r=new Rng(seed);List<List<Tick>> all=new ArrayList<>();int[] p=BASE.clone();for(int j=0;j<6;j++)all.add(new ArrayList<>());
  for(int i=1;i<=TICKS;i++)for(int j=0;j<6;j++){
   int raw=(int)(r.next()%41)-20;int step=scenario.equals("quiet")?0:raw+(scenario.equals("trend")?(j%2==0?9:-9):0);
   p[j]=nextPrice(p[j],step);int half=1+(int)(r.next()%8),size=10*(1+(int)(r.next()%100));all.get(j).add(new Tick(i,p[j],size,p[j]-half,p[j]+half));
  }return all;
 }
 public static Snapshot snapshot(List<List<Tick>> all,int symbol,int cursor,int width){
  if(all==null||all.size()!=6||symbol<0||symbol>=6||cursor<1||cursor>TICKS||!(width==5||width==10||width==20))throw new IllegalArgumentException("Invalid snapshot inputs");
  List<Tick> ticks=all.get(symbol);if(ticks.size()!=TICKS)throw new IllegalArgumentException("Invalid tape");
  long vol=0,pv=0;int high=Integer.MIN_VALUE,low=Integer.MAX_VALUE;List<Double> path=new ArrayList<>();List<Bar> bars=new ArrayList<>();
  for(int i=0;i<cursor;i++){Tick t=ticks.get(i);vol+=t.size;pv+=(long)t.price*t.size;high=Math.max(high,t.price);low=Math.min(low,t.price);path.add((double)pv/vol);}
  for(int i=0;i<cursor;i+=width){int end=Math.min(cursor,i+width),h=Integer.MIN_VALUE,l=Integer.MAX_VALUE;long v=0;for(int k=i;k<end;k++){Tick t=ticks.get(k);h=Math.max(h,t.price);l=Math.min(l,t.price);v+=t.size;}bars.add(new Bar(i+1,end,ticks.get(i).price,h,l,ticks.get(end-1).price,v,end-i==width));}
  Tick t=ticks.get(cursor-1);List<Tick> recent=new ArrayList<>();for(int i=cursor-1;i>=Math.max(0,cursor-10);i--)recent.add(ticks.get(i));
  return new Snapshot(BASE[symbol],t.price,t.bid,t.ask,high,low,vol,pv,(double)pv/vol,100.0*(t.price-BASE[symbol])/BASE[symbol],10000.0*(t.ask-t.bid)/((t.ask+t.bid)/2.0),path,bars,recent);
 }
}
