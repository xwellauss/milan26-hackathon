from fastapi import FastAPI

app = FastAPI()

@app.get('/')
async def root():
    return {"message": "Milan 2026"}

@app.get('/students/{branch}')
async def students_branch(branch):
    return {"branch": branch}
