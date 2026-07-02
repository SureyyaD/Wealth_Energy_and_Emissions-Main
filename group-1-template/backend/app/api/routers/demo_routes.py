from fastapi import APIRouter
import random

demo_router = APIRouter(tags=["demo"])

@demo_router.get("/random-number")
async def get_random_number():
    # Example API endpoint for returning a random number
    rand_int = random.randint(1, 100)
    print("sending: " + str(rand_int))
    return {"randomNumber": rand_int}
