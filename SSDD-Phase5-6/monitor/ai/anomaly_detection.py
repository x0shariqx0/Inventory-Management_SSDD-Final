cpu_usage = [12, 15, 14, 16, 13, 95]

average = sum(cpu_usage) / len(cpu_usage)

print("AI/ML Anomaly Detection for Inventory Management System")
print("------------------------------------------------------")
print(f"Average CPU Usage: {average:.2f}%")
print()

for value in cpu_usage:
    if value > average * 2:
        status = "Anomaly Detected"
    else:
        status = "Normal"

    print(f"CPU Usage: {value}% => {status}")