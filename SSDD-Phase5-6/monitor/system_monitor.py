import time
import random

print("Inventory Management System Monitoring")
print("--------------------------------------")

for i in range(5):
    cpu = random.randint(10, 90)
    memory = random.randint(20, 85)

    print(f"Check {i+1}: CPU Usage = {cpu}% | Memory Usage = {memory}%")

    if cpu > 75 or memory > 75:
        print("Alert: High resource usage detected!")

    time.sleep(1)
