"""Small hand-authored labeled dataset for the return-reason classifier.

Two classes: "hardware_defect" (something is physically broken/faulty) and
"personal_dissatisfaction" (the item works, the customer just doesn't want it).
Phrasing spans coolers, heaters, and fans so the classifier generalizes across
product categories rather than memorizing one product's vocabulary.
"""

HARDWARE_DEFECT = [
    "The cooler stopped working after just two days, the motor makes a grinding noise.",
    "Heater won't turn on at all, I think the heating element is broken.",
    "Fan blades are wobbling and it makes a loud rattling sound every time I switch it on.",
    "There's a burning smell coming from the heater, seems like a wiring issue.",
    "The cooler's water pump is leaking from the bottom, clearly a manufacturing defect.",
    "Fan motor overheats and shuts off automatically within minutes of use.",
    "Display panel on the heater is completely dead, no power indicator lights up.",
    "The remote control doesn't pair with the fan, the receiver seems faulty.",
    "Ice formed inside the cooler's cooling pads and it cracked the plastic body.",
    "Several of the blades on this fan are chipped right out of the box.",
    "Thermostat on the heater is stuck and it keeps overheating the room dangerously.",
    "The cooler tank has a crack and water leaks all over the floor.",
    "Switch button is jammed, physically cannot turn the fan off.",
    "Internal circuit fried within a week, there was a small spark from the socket.",
    "The oscillation mechanism is broken, fan only points in one direction now.",
    "Heater trips the circuit breaker every single time I plug it in.",
    "Cooling pads arrived torn and the pump doesn't draw water at all.",
    "The fan's capacitor burned out and now it won't start spinning.",
    "Power cord is frayed and exposed, this is a serious electrical hazard.",
    "The heater's fan inside rattles loudly, something is loose or broken internally.",
    "Cooler motor seized up completely after a week of normal use.",
    "The on/off indicator light flickers and the unit randomly shuts down by itself.",
    "A part was missing from the box and now the fan assembly won't click together.",
    "The grille on the heater is cracked and a fan blade inside is bent.",
    "Water is leaking from a crack in the cooler's side panel, defective housing.",
]

PERSONAL_DISSATISFACTION = [
    "The cooler works fine but it's way too noisy for my bedroom, not what I expected.",
    "Heater does its job but honestly I just don't like how bulky it looks in my living room.",
    "Fan is okay but I realized I don't really need it anymore, returning for a refund.",
    "I thought this cooler would cover a bigger room, it's underwhelming for the price.",
    "Heater is fine functionally, I just changed my mind and want something more compact.",
    "The fan's design clashes with my room decor, works perfectly but not for me.",
    "Cooling isn't as strong as I hoped, I expected better performance for this price point.",
    "Bought two by mistake, this one works great but I don't need a second fan.",
    "The heater is heavier than I expected and hard for me to move around, returning it.",
    "It works but I found a cheaper alternative with similar features elsewhere.",
    "Not satisfied with the overall look and feel, was expecting a premium finish.",
    "The fan is quieter than advertised actually, I was hoping for more airflow though.",
    "I just don't like the color I ordered, everything works as it should.",
    "This cooler is a bit too small for my patio, functionally it's fine.",
    "Changed my mind after seeing a better model, this heater works without issues.",
    "The fan runs great, I just don't think I'll use it enough to keep it.",
    "Heater works as described but it doesn't match the rest of my furniture.",
    "The cooler does what it says, I just expected a sleeker design for this price.",
    "Everything works fine, I simply ordered the wrong size for my room.",
    "The fan is a bit too tall for my desk, no issues with how it runs though.",
    "Heater functions properly, I just want to return it since my room already has one.",
    "Cooler is fine but I realized I prefer a different brand after reading more reviews.",
    "This fan works well, I just decided to go with a ceiling fan instead.",
    "No complaints about performance, I simply wasn't happy with the delivery packaging.",
    "The heater works but I'm returning it since it's louder than I personally prefer.",
]

TRAINING_DATA = [(text, "hardware_defect") for text in HARDWARE_DEFECT] + [
    (text, "personal_dissatisfaction") for text in PERSONAL_DISSATISFACTION
]
