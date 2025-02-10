import os
from openai import OpenAI
import sys
import base64

errorTextB64 = sys.argv[1] if len(sys.argv) > 1 else None
decoded_bytes = base64.b64decode(errorTextB64)
errorText = decoded_bytes.decode('unicode-escape')

# Make sure this ENV variable exists:
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

example = r"""
[vue/compiler-sfc] Unexpected token, expected "," (62:4)

/Users/whomstve/projects/nzt48/src/components/layout/ContentLayout.vue
94 |        return vOn
95 |      }
96 |      refreshable () {
   |      ^
97 |        const refreshable = isFunction(this.refresh)
98 |        console.log('>>> check refreshable', refreshable)
 @ ./src/components/layout/ContentLayout.vue?vue&type=template&id=2e5343ce&scoped=true 1:0-476 1:0-476
 @ ./src/components/layout/ContentLayout.vue 1:0-86 8:68-74 18:85-20:3 19:29-35 18:2-20:4
 @ ./src/setup/global-components.js 4:0-65 28:33-46
 @ ./src/ sync \.(xml%7Cjs%7C(?<%21\.d\.)ts%7Cs?css)$ ./setup/global-components.js
 @ ./node_modules/@nativescript/webpack/dist/stubs/virtual-entry-typescript.js 3:16-103
"""

# Define the custom system instructions (replace with your custom instructions)
custom_instructions = (
    "You're an Unreal Tournament style announcer voice tasked with calling out coding errors and have one short sentence to describe this."
    "The first input line is usually the source module followed by the compiler error message"
    "The second line is usually empty"
    "The third line is the file name"
    "Fourth line onwards is the code frame showing the source code and location of the error"
    "Look at the code and file name and folder structure for context and thoroughly understand the problem"
    "In your response, Include the relevant file name when possible"
    "You must suggest a practical fix"
    "Avoid vague unhelpful responses like 'ensure function correctly formatted.', instead prefer 'remove the extra comma on line 57 before the Refreshable method' or 'missing a comma on line 57 before the Refreshable method'"
    "Use the file name to get a better understanding of the type of file and what the likely issue is, for example: 'layout/ContentLayout.vue' is likely a Vue SFC component used for app layout."
    "It should be short and sweet while still making sure to be precise and helpful."
    "Important: no more than 15 words total."
)

# Define the conversation messages including the system prompt and a sample user message
messages = [
    { "role": "system", "content": custom_instructions },
    { "role": "user", "content": errorText }
]

try:
    # Call the ChatCompletion API with your model and messages
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # TODO: configurable model
        messages=messages
    )

    # Extract and print the assistant's reply
    reply = response.choices[0].message.content
    print(reply, file=sys.stdout)

except Exception as e:
    print("Error:", e)
