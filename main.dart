import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:io';

const unicronRed = Color(0xFFD71921);
const unicronBlack = Color(0xFF111111);
const unicronPeach = Color(0xFFFFF1ED);

void main() { runApp(const UnicronApp()); }

class UnicronApp extends StatelessWidget {
  const UnicronApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Unicron+ Installer',
      theme: ThemeData(
        primaryColor: unicronRed,
        scaffoldBackgroundColor: unicronPeach,
        appBarTheme: const AppBarTheme(backgroundColor: unicronRed, foregroundColor: Colors.white, centerTitle: true),
        elevatedButtonTheme: ElevatedButtonThemeData(style: ElevatedButton.styleFrom(backgroundColor: unicronRed, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)))),
      ),
      home: const RegistrationScreen(),
    );
  }
}

List<String> models = ['Unicron Nova 2 KVA','Unicron Nova 3.5 KVA','Unicron Nova 4.2 KVA','Unicron Nova 6.2 KVA','Unicron 12 KVA','Unicron 15 Kw Lithium Battery'];

class RegistrationScreen extends StatefulWidget { const RegistrationScreen({super.key}); @override State<RegistrationScreen> createState()=> _RegistrationScreenState(); }
class _RegistrationScreenState extends State<RegistrationScreen> {
  final nameC=TextEditingController(), compC=TextEditingController(), phoneC=TextEditingController(), stateC=TextEditingController(), expC=TextEditingController();
  XFile? selfie, nin; bool otp=false;
  @override Widget build(BuildContext context){
    return Scaffold(appBar: AppBar(title: const Text('Installer Registration', style: TextStyle(fontWeight: FontWeight.w900))), body: SingleChildScrollView(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Join Unicron+ Installer', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)), const SizedBox(height:6),
      const Text('Flat ₦5,000 per install • Min withdraw ₦10,000', style: TextStyle(color: unicronRed, fontWeight: FontWeight.w700)),
      const SizedBox(height:18),
      _f(nameC,'Full Name'), _f(compC,'Company Name'), _f(phoneC,'Phone No', TextInputType.phone), _f(stateC,'State'), _f(expC,'Years Exp', TextInputType.number),
      const SizedBox(height:10), const Text('KYC - Selfie is Must', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height:8),
      Row(children: [Expanded(child: _box(selfie,'Selfie\nCamera Only', ()async{ final p=ImagePicker(); final f=await p.pickImage(source: ImageSource.camera); if(f!=null)setState(()=>selfie=f); })),
        const SizedBox(width:10), Expanded(child: _box(nin,'NIN\nOptional', ()async{ final p=ImagePicker(); final f=await p.pickImage(source: ImageSource.camera); if(f!=null)setState(()=>nin=f); }))]),
      const SizedBox(height:20),
      if(!otp) SizedBox(width: double.infinity, child: ElevatedButton(onPressed: ()=>setState(()=>otp=true), child: const Text('Send OTP'))),
      if(otp)...[ TextField(decoration: InputDecoration(labelText: 'Enter OTP', filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(15))), keyboardType: TextInputType.number), const SizedBox(height:12),
        SizedBox(width: double.infinity, child: ElevatedButton(onPressed: ()=>Navigator.pushReplacement(context, MaterialPageRoute(builder: (_)=>const HomeScreen())), child: const Text('Verify & Register')))]
    ])));
  }
  Widget _f(TextEditingController c,String l,[TextInputType t=TextInputType.text])=> Padding(padding: const EdgeInsets.only(bottom:12), child: TextField(controller:c, keyboardType:t, decoration: InputDecoration(labelText:l, filled:true, fillColor:Colors.white, border:OutlineInputBorder(borderRadius:BorderRadius.circular(15)))));
  Widget _box(XFile? f,String l,VoidCallback o)=> GestureDetector(onTap:o, child: Container(height:90, decoration: BoxDecoration(color:Colors.white, borderRadius:BorderRadius.circular(15), border:Border.all(color: f==null?Colors.grey.shade300:unicronRed)), child: f==null?Center(child: Text(l, textAlign:TextAlign.center, style: const TextStyle(fontSize:11, fontWeight:FontWeight.bold))):ClipRRect(borderRadius:BorderRadius.circular(15), child: Image.file(File(f.path), fit:BoxFit.cover, width:double.infinity))));
}

class HomeScreen extends StatelessWidget { const HomeScreen({super.key}); @override Widget build(BuildContext context){
  return Scaffold(appBar: AppBar(title: const Text('Unicron+ Installer', style: TextStyle(fontWeight: FontWeight.w900))), body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(children: [
    Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: unicronBlack, borderRadius:BorderRadius.circular(24)), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      const Column(crossAxisAlignment:CrossAxisAlignment.start, children:[Text('Wallet Balance', style:TextStyle(color:Colors.white54, fontSize:11)), Text('₦15,000', style:TextStyle(color:Colors.white, fontSize:28, fontWeight:FontWeight.w900)), Text('Min ₦10,000 to withdraw', style:TextStyle(color:Colors.white54, fontSize:10))]),
      ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor:Colors.white, foregroundColor:Colors.black), onPressed: (){}, child: const Text('Withdraw', style:TextStyle(fontWeight:FontWeight.w900)))
    ])),
    const SizedBox(height:12),
    Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color:Colors.white, borderRadius:BorderRadius.circular(20), border:Border.all(color: unicronRed.withOpacity(0.15))), child: Column(crossAxisAlignment:CrossAxisAlignment.start, children: [
      const Row(mainAxisAlignment:MainAxisAlignment.spaceBetween, children:[Text('Scheme: 5 installs = ₦20K Extra', style:TextStyle(fontWeight:FontWeight.bold, color:unicronRed, fontSize:12)), Text('3/5', style:TextStyle(fontWeight:FontWeight.w900))]),
      const SizedBox(height:8), const LinearProgressIndicator(value:0.6, backgroundColor:Color(0xFFFFE2E2), color:unicronRed), const SizedBox(height:6), const Text('2 more installs to unlock ₦20K Bonus!', style:TextStyle(fontSize:11, color:Colors.grey))
    ])),
    const SizedBox(height:16),
    _tile('Unicron Nova 6.2 KVA','2604340900039',true), _tile('Unicron Nova 3.5 KVA','2604340900019',true),
  ])),
  floatingActionButton: FloatingActionButton.extended(backgroundColor: unicronRed, onPressed: ()=>Navigator.push(context, MaterialPageRoute(builder: (_)=>const NewInstallScreen())), label: const Text('New Installation', style:TextStyle(color:Colors.white, fontWeight:FontWeight.bold)), icon: const Icon(Icons.add, color:Colors.white)));
}
Widget _tile(String m,String s,bool a)=> Container(margin: const EdgeInsets.only(bottom:10), padding: const EdgeInsets.all(14), decoration: BoxDecoration(color:Colors.white, borderRadius:BorderRadius.circular(16), border:Border.all(color:Colors.grey.shade200)), child: Row(children: [
  Container(width:48, height:48, decoration: BoxDecoration(color: unicronPeach, borderRadius:BorderRadius.circular(12)), child: const Icon(Icons.bolt, color:unicronRed)), const SizedBox(width:12),
  Expanded(child: Column(crossAxisAlignment:CrossAxisAlignment.start, children:[Text(m, style: const TextStyle(fontWeight:FontWeight.bold)), Text('S/N: $s', style: const TextStyle(fontSize:11, color:Colors.grey)), Text(a?'Approved - ₦5,000':'Pending Approval', style: TextStyle(fontSize:11, color:a?Colors.green:Colors.orange, fontWeight:FontWeight.bold))]))
]));
}

class NewInstallScreen extends StatefulWidget { const NewInstallScreen({super.key}); @override State<NewInstallScreen> createState()=> _NewInstallScreenState(); }
class _NewInstallScreenState extends State<NewInstallScreen> {
  String? sel; final serialC=TextEditingController(); XFile? i1,i2,i3; Position? pos;
  @override void initState(){ super.initState(); _loc(); }
  Future<void> _loc() async { try{ final p=await Geolocator.getCurrentPosition(); setState(()=>pos=p); }catch(_){} }
  @override Widget build(BuildContext context){
    return Scaffold(appBar: AppBar(title: const Text('New Installation')), body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment:CrossAxisAlignment.start, children: [
      const Text('Select Model', style:TextStyle(fontWeight:FontWeight.bold)), const SizedBox(height:8),
      DropdownButtonFormField<String>(value:sel, hint: const Text('Choose Model'), items: models.map((m)=>DropdownMenuItem(value:m, child:Text(m, style: const TextStyle(fontSize:12)))).toList(), onChanged:(v)=>setState(()=>sel=v), decoration: InputDecoration(filled:true, fillColor:Colors.white, border:OutlineInputBorder(borderRadius:BorderRadius.circular(15)))),
      const SizedBox(height:12), TextField(controller:serialC, decoration: InputDecoration(labelText:'Serial No (2604340900039)', filled:true, fillColor:Colors.white, border:OutlineInputBorder(borderRadius:BorderRadius.circular(15))), keyboardType:TextInputType.number),
      const SizedBox(height:6), Text(pos==null?'Getting GPS...':'GPS: ${pos!.latitude.toStringAsFixed(4)}, ${pos!.longitude.toStringAsFixed(4)}', style: const TextStyle(fontSize:11, color:Colors.green)),
      const SizedBox(height:16), const Text('Upload 3 Photos - Camera Only', style:TextStyle(fontWeight:FontWeight.bold)), const SizedBox(height:8),
      Row(children: [Expanded(child: _up(i1,'Install\nPhoto', (f)=>setState(()=>i1=f))), const SizedBox(width:8), Expanded(child: _up(i2,'Serial\nSticker', (f)=>setState(()=>i2=f))), const SizedBox(width:8), Expanded(child: _up(i3,'Full Setup', (f)=>setState(()=>i3=f)))]),
      const SizedBox(height:20), SizedBox(width: double.infinity, child: ElevatedButton(onPressed: (){ if(sel==null||serialC.text.isEmpty||i1==null||i2==null||i3==null){ ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Fill all + 3 photos'))); return; } ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Submitted! Pending approval by Store Manager'))); Navigator.pop(context); }, child: const Padding(padding:EdgeInsets.symmetric(vertical:4), child:Text('Submit for Approval', style:TextStyle(fontWeight:FontWeight.bold))))),
      const SizedBox(height:10), const Text('Note: Duplicate Serial auto-reject. Withdraw min ₦10K via Manual Bank Transfer Phase 1. RELIABLE POWER. LIMITLESS POSSIBILITIES.', style:TextStyle(fontSize:10, color:Colors.grey))
    ])));
  }
  Widget _up(XFile? f,String l,Function(XFile) onPick){ return GestureDetector(onTap: ()async{ final p=ImagePicker(); final im=await p.pickImage(source: ImageSource.camera, imageQuality:70); if(im!=null)onPick(im); }, child: Container(height:105, decoration: BoxDecoration(color:Colors.white, borderRadius:BorderRadius.circular(16), border:Border.all(color: f==null?Colors.grey.shade300:unicronRed)), child: f==null?Center(child: Text(l, textAlign:TextAlign.center, style: const TextStyle(fontSize:10, fontWeight:FontWeight.bold))):ClipRRect(borderRadius:BorderRadius.circular(16), child: Image.file(File(f.path), fit:BoxFit.cover, width:double.infinity, height:double.infinity)))); }
}