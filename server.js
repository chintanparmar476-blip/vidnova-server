// VidNova Server  –  Admin: chintan@vidnova / upload@2410
const express        = require('express');
const multer         = require('multer');
const cors           = require('cors');
const session        = require('express-session');
const path           = require('path');
const fs             = require('fs');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = 3000;

['uploads/videos','uploads/thumbnails','data'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DB_MOVIES = path.join(__dirname,'data','movies.json');
const DB_USERS  = path.join(__dirname,'data','users.json');
const readMovies  = () => { if(!fs.existsSync(DB_MOVIES)) fs.writeFileSync(DB_MOVIES,'[]'); return JSON.parse(fs.readFileSync(DB_MOVIES)); };
const writeMovies = d => fs.writeFileSync(DB_MOVIES, JSON.stringify(d,null,2));
const readUsers   = () => { if(!fs.existsSync(DB_USERS))  fs.writeFileSync(DB_USERS,'[]');  return JSON.parse(fs.readFileSync(DB_USERS)); };
const writeUsers  = d => fs.writeFileSync(DB_USERS, JSON.stringify(d,null,2));

const ADMIN = { email:'chintan@vidnova', password:'upload@2410' };

app.use(cors({ origin:true, credentials:true }));
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'vidnova_2025_secret', resave:false, saveUninitialized:false, cookie:{ maxAge:86400000, secure: process.env.NODE_ENV==='production', sameSite: process.env.NODE_ENV==='production' ? 'none' : 'lax' } }));
app.use(express.static(path.join(__dirname,'public')));
app.use('/videos',     express.static(path.join(__dirname,'uploads/videos')));
app.use('/thumbnails', express.static(path.join(__dirname,'uploads/thumbnails')));

const storage = multer.diskStorage({
  destination:(req,file,cb) => cb(null, file.fieldname==='thumbnail'?'uploads/thumbnails':'uploads/videos'),
  filename:(req,file,cb) => cb(null, uuidv4()+path.extname(file.originalname).toLowerCase())
});
const upload = multer({ storage, limits:{ fileSize:4*1024*1024*1024 },
  fileFilter:(req,file,cb) => {
    if(file.fieldname==='thumbnail') return cb(null,/image\/(jpeg|jpg|png|webp)/.test(file.mimetype));
    return cb(null, /\.(mp4|mkv|avi|mov|webm)$/i.test(file.originalname) || /video\//.test(file.mimetype));
  }
});

const reqAdmin = (req,res,next) => req.session.admin ? next() : res.status(401).json({error:'Unauthorized'});
const reqUser  = (req,res,next) => (req.session.user||req.session.admin) ? next() : res.status(401).json({error:'Sign in required'});

// AUTH
app.post('/api/admin/login',(req,res)=>{
  const{email,password}=req.body;
  if(email===ADMIN.email&&password===ADMIN.password){
    req.session.admin=true; req.session.user={email,name:'Chintan',role:'admin'};
    return res.json({success:true});
  }
  res.status(401).json({error:'Invalid credentials'});
});
app.post('/api/signup',(req,res)=>{
  const{name,email,password}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
  const users=readUsers();
  if(users.find(u=>u.email===email)) return res.status(400).json({error:'Email already registered'});
  const user={id:uuidv4(),name,email,password,plan:'standard',joined:new Date().toISOString()};
  users.push(user); writeUsers(users);
  req.session.user={id:user.id,name,email,plan:'standard',role:'user'};
  res.json({success:true,user:req.session.user});
});
app.post('/api/signin',(req,res)=>{
  const{email,password}=req.body;
  if(email===ADMIN.email&&password===ADMIN.password){
    req.session.admin=true; req.session.user={email,name:'Chintan',role:'admin'};
    return res.json({success:true,role:'admin',user:req.session.user});
  }
  const user=readUsers().find(u=>u.email===email&&u.password===password);
  if(!user) return res.status(401).json({error:'Invalid email or password'});
  req.session.user={id:user.id,name:user.name,email:user.email,plan:user.plan,role:'user'};
  res.json({success:true,role:'user',user:req.session.user});
});
app.post('/api/signout',(req,res)=>{ req.session.destroy(); res.json({success:true}); });
app.get('/api/me',(req,res)=>{
  if(req.session.user) return res.json({user:req.session.user,admin:!!req.session.admin});
  res.status(401).json({error:'Not signed in'});
});
app.post('/api/plan',reqUser,(req,res)=>{
  const{plan}=req.body;
  if(!['basic','standard','premium'].includes(plan)) return res.status(400).json({error:'Invalid plan'});
  req.session.user.plan=plan;
  const users=readUsers(); const idx=users.findIndex(u=>u.id===req.session.user.id);
  if(idx>-1){users[idx].plan=plan;writeUsers(users);}
  res.json({success:true,plan});
});
app.put('/api/profile',reqUser,(req,res)=>{
  const{name,phone}=req.body;
  const users=readUsers(); const idx=users.findIndex(u=>u.id===req.session.user.id);
  if(idx>-1){if(name)users[idx].name=name;if(phone)users[idx].phone=phone;writeUsers(users);req.session.user.name=users[idx].name;}
  res.json({success:true});
});

// MOVIES PUBLIC
app.get('/api/movies',(req,res)=>{
  const movies=readMovies().filter(m=>m.status==='published');
  res.json(movies.map(m=>({...m,thumbnailUrl:`/thumbnails/${m.thumbnail}`,videoUrl:`/api/stream/${m.id}`})));
});
app.get('/api/movies/search',(req,res)=>{
  const q=(req.query.q||'').toLowerCase(), genre=req.query.genre||'';
  let movies=readMovies().filter(m=>m.status==='published');
  if(q) movies=movies.filter(m=>m.title.toLowerCase().includes(q)||m.genre.toLowerCase().includes(q)||(m.cast||[]).some(c=>c.toLowerCase().includes(q)));
  if(genre) movies=movies.filter(m=>m.genre===genre);
  res.json(movies.map(m=>({...m,thumbnailUrl:`/thumbnails/${m.thumbnail}`})));
});
app.get('/api/movies/:id',(req,res)=>{
  const m=readMovies().find(m=>m.id===req.params.id);
  if(!m) return res.status(404).json({error:'Not found'});
  res.json({...m,thumbnailUrl:`/thumbnails/${m.thumbnail}`,videoUrl:`/api/stream/${m.id}`});
});

// VIDEO STREAM with Range support
app.get('/api/stream/:id',reqUser,(req,res)=>{
  const movie=readMovies().find(m=>m.id===req.params.id);
  if(!movie) return res.status(404).send('Movie not found');
  const filePath=path.join(__dirname,'uploads/videos',movie.videoFile);
  if(!fs.existsSync(filePath)) return res.status(404).send('Video file missing');
  const stat=fs.statSync(filePath), fileSize=stat.size, range=req.headers.range;
  const mimes={'.mp4':'video/mp4','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.mov':'video/quicktime','.webm':'video/webm'};
  const mime=mimes[path.extname(movie.videoFile).toLowerCase()]||'video/mp4';
  if(!range){
    // update views on first load
    try{const ms=readMovies();const i=ms.findIndex(m=>m.id===req.params.id);if(i>-1){ms[i].views=(ms[i].views||0)+1;writeMovies(ms);}}catch(e){}
    res.writeHead(200,{'Content-Length':fileSize,'Content-Type':mime});
    fs.createReadStream(filePath).pipe(res);
  } else {
    const[s,e]=range.replace(/bytes=/,'').split('-');
    const start=parseInt(s,10), end=e?parseInt(e,10):fileSize-1, chunk=(end-start)+1;
    res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${fileSize}`,'Accept-Ranges':'bytes','Content-Length':chunk,'Content-Type':mime});
    fs.createReadStream(filePath,{start,end}).pipe(res);
  }
});

// ADMIN ROUTES
app.post('/api/admin/upload',reqAdmin,upload.fields([{name:'video',maxCount:1},{name:'thumbnail',maxCount:1}]),(req,res)=>{
  try{
    if(!req.files?.video)     return res.status(400).json({error:'Video file required'});
    if(!req.files?.thumbnail) return res.status(400).json({error:'Thumbnail required'});
    const{title,genre,year,language,age,duration,description,cast,director,tags}=req.body;
    const movies=readMovies();
    const movie={
      id:uuidv4(), title:title.trim(), genre, year:parseInt(year)||2024,
      language:language||'Hindi', age:age||'U/A', duration:parseInt(duration)||0,
      description:description.trim(),
      cast:cast?cast.split(',').map(s=>s.trim()).filter(Boolean):[],
      director:director?.trim()||'',
      tags:tags?tags.split(',').map(s=>s.trim()).filter(Boolean):[],
      videoFile:req.files.video[0].filename,
      thumbnail:req.files.thumbnail[0].filename,
      status:'published',
      rating:parseFloat((Math.random()*2+7).toFixed(1)),
      views:0, uploadedAt:new Date().toISOString(), uploadedBy:'chintan@vidnova'
    };
    movies.push(movie); writeMovies(movies);
    console.log(`✅  Uploaded: "${movie.title}"`);
    res.json({success:true,movie});
  }catch(err){ console.error(err); res.status(500).json({error:err.message}); }
});
app.get('/api/admin/movies',reqAdmin,(req,res)=>res.json(readMovies()));
app.get('/api/admin/users',reqAdmin,(req,res)=>res.json(readUsers().map(u=>({...u,password:undefined}))));
app.put('/api/admin/movies/:id',reqAdmin,(req,res)=>{
  const ms=readMovies(); const i=ms.findIndex(m=>m.id===req.params.id);
  if(i<0) return res.status(404).json({error:'Not found'});
  ms[i]={...ms[i],...req.body,id:ms[i].id,videoFile:ms[i].videoFile,thumbnail:ms[i].thumbnail};
  writeMovies(ms); res.json({success:true,movie:ms[i]});
});
app.delete('/api/admin/movies/:id',reqAdmin,(req,res)=>{
  const ms=readMovies(); const m=ms.find(x=>x.id===req.params.id);
  if(!m) return res.status(404).json({error:'Not found'});
  [path.join(__dirname,'uploads/videos',m.videoFile),path.join(__dirname,'uploads/thumbnails',m.thumbnail)]
    .forEach(f=>{try{if(fs.existsSync(f))fs.unlinkSync(f);}catch(e){}});
  writeMovies(ms.filter(x=>x.id!==req.params.id));
  res.json({success:true});
});
app.post('/api/admin/movies/:id/toggle',reqAdmin,(req,res)=>{
  const ms=readMovies(); const i=ms.findIndex(m=>m.id===req.params.id);
  if(i<0) return res.status(404).json({error:'Not found'});
  ms[i].status=ms[i].status==='published'?'draft':'published'; writeMovies(ms);
  res.json({success:true,status:ms[i].status});
});
app.get('/api/admin/stats',reqAdmin,(req,res)=>{
  const ms=readMovies(), us=readUsers();
  let size=0; const vd=path.join(__dirname,'uploads/videos');
  if(fs.existsSync(vd)) fs.readdirSync(vd).forEach(f=>{try{size+=fs.statSync(path.join(vd,f)).size;}catch(e){}});
  res.json({ totalMovies:ms.length, publishedMovies:ms.filter(m=>m.status==='published').length,
    draftMovies:ms.filter(m=>m.status==='draft').length, totalUsers:us.length,
    totalViews:ms.reduce((a,m)=>a+(m.views||0),0), totalSize:(size/1073741824).toFixed(2)+' GB' });
});

app.get('*',(req,res)=>{
  const f=path.join(__dirname,'public',req.path);
  if(fs.existsSync(f)&&fs.statSync(f).isFile()) return res.sendFile(f);
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT,()=>{
  console.log('\n🎬 ══════════════════════════════════');
  console.log(`   VidNova Server → http://localhost:${PORT}`);
  console.log(`   Admin Panel   → http://localhost:${PORT}/admin.html`);
  console.log(`   Login: chintan@vidnova / upload@2410`);
  console.log('🎬 ══════════════════════════════════\n');
});
