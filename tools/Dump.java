import tapeleaf.Engine;import java.util.*;import java.lang.reflect.*;
public class Dump{
 static String json(Object x)throws Exception{if(x==null)return"null";if(x instanceof String)return"\""+x+"\"";if(x instanceof Number||x instanceof Boolean)return x.toString();List<String> a=new ArrayList<>();if(x instanceof List<?> l){for(Object v:l)a.add(json(v));return"["+String.join(",",a)+"]";}for(var c:x.getClass().getRecordComponents())a.add("\""+c.getName()+"\":"+json(c.getAccessor().invoke(x)));return"{"+String.join(",",a)+"}";}
 public static void main(String[]args)throws Exception{var a=Engine.generate(Long.parseLong(args[0]),args[1]);List<Object> out=new ArrayList<>();out.add(a);for(int j=0;j<6;j++)for(int c:new int[]{1,5,6,10,11,59,60,119,120})for(int w:new int[]{5,10,20})out.add(Engine.snapshot(a,j,c,w));System.out.println(json(out));}
}
