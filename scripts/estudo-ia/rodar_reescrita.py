import json, sys, time, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
model_id = sys.argv[1]; out = sys.argv[2]
torch.set_num_threads(4)
tok = AutoTokenizer.from_pretrained(model_id)
t0=time.time()
m = AutoModelForCausalLM.from_pretrained(model_id, dtype=torch.bfloat16)
m.eval()
load = time.time()-t0
SYSTEM = ("Você é um analista de Service Desk brasileiro. Reescreva a mensagem do usuário para soar natural, humana e cordial, "
 "como um analista experiente escreveria no sistema de chamados. Regras obrigatórias: mantenha TODOS os fatos, nomes, números, datas e horários exatamente como estão; "
 "não invente prazos, causas, promessas ou ações; não acrescente informações; fale com a pessoa em segunda pessoa ('você', 'seu') quando a mensagem for para ela; "
 "mantenha a saudação e a assinatura; português do Brasil; sem travessão, sem emoji, sem letras maiúsculas para ênfase. Responda somente com a mensagem reescrita.")
drafts = json.load(open('rascunhos.json'))
res=[]
for d in drafts:
    msgs=[{"role":"system","content":SYSTEM},{"role":"user","content":d['text']}]
    ids = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors='pt', return_dict=True)
    t=time.time()
    with torch.no_grad():
        o = m.generate(**ids, max_new_tokens=350, do_sample=False, repetition_penalty=1.05)
    gen = o[0][ids['input_ids'].shape[1]:]
    dt=time.time()-t
    text = tok.decode(gen, skip_special_tokens=True).strip()
    res.append({'type':d['type'],'draft':d['text'],'rewrite':text,'sec':round(dt,1),'tokens':int(gen.shape[0])})
    print(d['type'], round(dt,1),'s', int(gen.shape[0]),'tok', flush=True)
json.dump({'model':model_id,'load_sec':round(load,1),'results':res}, open(out,'w'), ensure_ascii=False, indent=1)
