import tkinter as tk
from tkinter import ttk
import csv

dictionary = {}
with open('resources/dict.csv', newline='', encoding='utf-16') as csvfile:
    reader = csv.reader(csvfile, delimiter=',', quotechar='"')
    for row in reader:
        dictionary[row[0]] = (row[1], row[2])

selected_file = "resources/selected.txt"
selected_id = "resources/selected_id.txt"

def save(suggestion):
    with open(selected_id, "w") as f:
        f.write(str(dictionary[suggestion][1]))
    with open(selected_file, "w") as f:
        f.write(suggestion)

def on_suggestion_click(event):
    selection = suggestion_listbox.curselection()
    if selection:
        index = selection[0]
        suggestion = suggestion_listbox.get(index)
        textbox.delete(1.0, tk.END)
        textbox.insert(tk.END, suggestion)
        save(suggestion)

def update_suggestions(event=None):
    current_text = textbox.get(1.0, tk.END).strip()
    suggestions = [k for k in dictionary.keys() if current_text.lower() in k.lower()]
    suggestion_listbox.delete(0, tk.END)
    for suggestion in suggestions:
        suggestion_listbox.insert(tk.END, suggestion)

root = tk.Tk()
root.title("SDD Mod Helper")

# Create a frame for better organization
main_frame = ttk.Frame(root)
main_frame.pack(padx=20, pady=20)

# Textbox
textbox = tk.Text(main_frame, width=40, height=5)
textbox.grid(row=0, column=0, columnspan=2, pady=(0, 10))

# Clear Button
clear_button = ttk.Button(main_frame, text="Clear", command=lambda: textbox.delete(1.0, tk.END))
clear_button.grid(row=1, column=1, padx=(5, 0))

# Suggestions Listbox
suggestion_listbox = tk.Listbox(main_frame, width=40, height=5)
suggestion_listbox.grid(row=2, column=0, columnspan=2)

textbox.bind("<KeyRelease>", update_suggestions)
suggestion_listbox.bind("<<ListboxSelect>>", on_suggestion_click)
update_suggestions()

root.mainloop()
