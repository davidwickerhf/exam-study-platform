// Optional macOS verification transport when Node's outbound connection races
// time out. Secrets and request bodies travel over stdin, never process args.
import {spawn} from 'node:child_process'
export function neonCurlFetch(input,init={}) {
  return new Promise((resolve,reject)=>{
    const quote=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"'
    const headers=[...new Headers(init.headers).entries()]
    const config=['url = '+quote(input),'request = '+quote(init.method || 'GET'),...headers.map(([k,v])=>'header = '+quote(k+': '+v)),'data-binary = '+quote(init.body || '')].join('\n')
    const child=spawn('curl',['--config','-','--silent','--show-error','--connect-timeout','15','--max-time','45','--write-out','\n%{http_code}'],{stdio:['pipe','pipe','pipe']})
    const chunks=[];child.stdout.on('data',c=>chunks.push(c));child.stderr.resume()
    child.on('error',reject);child.on('close',code=>{
      if(code)return reject(new Error('Verification database transport failed: curl exit '+code))
      const text=Buffer.concat(chunks).toString(),line=text.lastIndexOf('\n')
      resolve(new Response(text.slice(0,line),{status:Number(text.slice(line+1)),headers:{'content-type':'application/json'}}))
    });child.stdin.end(config+'\n')
  })
}
