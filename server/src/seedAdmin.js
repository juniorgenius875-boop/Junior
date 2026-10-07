import { connectDb } from './db.js';
import { User } from './models/index.js';
import { hashPassword } from './services/auth.js';
const [email,password,name='Administrator']=process.argv.slice(2);
if(!email||!password){console.error('Usage: npm run seed:admin -- admin@example.com StrongPassword "Admin Name"');process.exit(1);}await connectDb();let user=await User.findOne({email:email.toLowerCase()});if(!user)user=new User({email:email.toLowerCase(),password_hash:await hashPassword(password),profile:{name}});else{user.password_hash=await hashPassword(password);user.profile={...(user.profile?.toObject?.()||user.profile||{}),name};}user.role='admin';user.is_active=true;await user.save();console.log(`Admin ready: ${user.email}`);process.exit(0);
