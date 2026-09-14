import { matchMessage, buildSequence, planJourney } from '../dist/index.js';

// Entirely synthetic. These names and edges do not describe a railway.
const profile = { id:'fictional', name:'Fictional printer', maxRows:4, fieldCells:8, order:'oldest-first' };
const stations = ['春風','花園','月台','起點','終點'].map((name,i)=>({
  id:String(i),name,region:'fictional',operator:'Example',nameSource:'synthetic:example',
  labels:[{id:'name',text:name,profileId:profile.id,verification:'unverified'}]
}));
const network = {
  id:'fictional',version:'1',source:'synthetic:example',license:'MIT',verification:'synthetic',currency:'JPY',
  stations:stations.map(s=>s.id),
  edges:[
    {id:'position',from:'3',to:'0',kind:'ride'},
    {id:'spring',from:'0',to:'1',kind:'ride'},
    {id:'flower',from:'1',to:'2',kind:'ride'},
    {id:'moon',from:'2',to:'4',kind:'ride'}
  ]
};
const rows=buildSequence(matchMessage('春花月',stations,{profileId:profile.id}));
const result=planJourney(rows,profile,network,{start:'3',end:'4'});
console.log(JSON.stringify(result,null,2));
