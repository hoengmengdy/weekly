import io
from datetime import date
from PIL import Image

BASE='/api/v1'


def item(**values):
    return {'title':'Poster ផលិតផលថ្មី','kind':'Poster','work_date':date.today().isoformat(),'department_id':1,'user_id':3,'task_id':1}|values


def png():
    stream=io.BytesIO()
    Image.new('RGB',(40,30),'green').save(stream,'PNG')
    stream.seek(0)
    return stream


def test_portfolio_is_super_admin_only(client,sign_in):
    for id in (2,3,6):
        sign_in(id)
        assert client.get(BASE+'/portfolio').status_code==403
        assert client.post(BASE+'/portfolio',json=item()).status_code==403


def test_portfolio_create_filter_summary_and_approval(client,sign_in):
    sign_in(1)
    poster=client.post(BASE+'/portfolio',json=item())
    assert poster.status_code==201,poster.json
    assert poster.json['status']=='Approved' and poster.json['employee_name']=='Person 3'
    video=client.post(BASE+'/portfolio',json=item(title='Product video',kind='Video',link='youtube.com/watch?v=abc',needs_approval=True))
    assert video.json['status']=='Pending' and video.json['link']=='https://youtube.com/watch?v=abc'
    listing=client.get(BASE+'/portfolio').json
    assert listing['total']==2 and listing['summary']['pending']==1
    assert listing['summary']['kinds']['Poster']=={'count':1,'departments':1}
    assert client.get(BASE+'/portfolio?kind=Video').json['total']==1
    assert client.get(BASE+'/portfolio?q=video').json['items'][0]['id']==video.json['id']
    assert client.get(BASE+'/portfolio?month=2000-01').json['total']==0
    assert client.post(BASE+f'/portfolio/{video.json["id"]}/approve').json['status']=='Approved'
    assert client.get(BASE+'/portfolio').json['summary']['pending']==0


def test_portfolio_rejects_bad_input(client,sign_in):
    sign_in(1)
    assert client.post(BASE+'/portfolio',json=item(kind='Audio')).status_code==422
    assert client.post(BASE+'/portfolio',json=item(link='https://a.com\nhttps://b.com')).status_code==422
    assert client.post(BASE+'/portfolio',json=item(department_id=999)).status_code==404
    assert client.get(BASE+'/portfolio?month=October').status_code==422


def test_portfolio_file_download_pdf_and_delete(client,sign_in):
    sign_in(1)
    id=client.post(BASE+'/portfolio',json=item()).json['id']
    uploaded=client.post(BASE+f'/portfolio/{id}/file',data={'file':(png(),'poster.png')},content_type='multipart/form-data')
    assert uploaded.status_code==200,uploaded.json
    file=uploaded.json['attachment']
    assert client.get(BASE+f'/attachments/{file["id"]}?inline=1').status_code==200
    pdf=client.get(BASE+'/exports/portfolio.pdf')
    assert pdf.status_code==200 and pdf.data.startswith(b'%PDF-')
    assert client.delete(BASE+f'/portfolio/{id}').status_code==200
    assert client.get(BASE+f'/attachments/{file["id"]}').status_code==404
    assert client.get(BASE+'/portfolio').json['total']==0
