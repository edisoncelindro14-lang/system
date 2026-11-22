const crypto=require('crypto');
const secret='super-secret-jwt-token-with-at-least-32-characters-long';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const h=b64({alg:'HS256',typ:'JWT'});
const p=b64({role:'anon',exp:Math.floor(Date.now()/1000)+3600});
const s=crypto.createHmac('sha256',secret).update(h+'.'+p).digest('base64url');
console.log(h+'.'+p+'.'+s);
