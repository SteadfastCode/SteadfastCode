<template>
  <v-container class="pa-4">
    <v-row>
      <v-col>
        <h1 class="text-h5 font-weight-bold mb-4">
          LeoAI Intent Management (Admin)
        </h1>
        <p class="text-body-2 text-grey-lighten-1 mb-4">
          Upload or paste a JSON file to create/update multiple Dialogflow
          intents in bulk, or use the form for manual entry.
        </p>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-card class="pa-4 mb-4">
          <v-subheader>Batch Intent Creation</v-subheader>
          <v-file-input
            label="Upload JSON File"
            accept=".json"
            v-model="jsonFile"
            variant="outlined"
            prepend-icon="mdi-file-upload"
            @change="handleFileUpload"
          ></v-file-input>
          <v-textarea
            label="Or Paste JSON Data"
            v-model="jsonInput"
            placeholder='[{"displayName": "BusinessHours", "trainingPhrases": ["What are your hours?"], "responses": ["We’re open from 7 AM to 5 PM."]}]'
            variant="outlined"
            rows="5"
            class="mb-4"
          ></v-textarea>
          <v-btn
            color="primary"
            @click="processJson"
            :loading="loading"
            :disabled="!jsonFile && !jsonInput"
          >
            Process JSON
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-expansion-panels v-model="panel" multiple>
          <v-expansion-panel
            v-for="(intent, index) in intents"
            :key="index"
            class="mb-2"
          >
            <v-expansion-panel-title>
              {{ intent.displayName || `Intent ${index + 1}` }}
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-text-field
                label="Intent Name"
                v-model="intent.displayName"
                placeholder="e.g., BusinessHours"
                variant="outlined"
                class="mb-4"
              ></v-text-field>
              <v-subheader>Training Phrases</v-subheader>
              <v-text-field
                v-for="(phrase, phraseIndex) in intent.trainingPhrases"
                :key="phraseIndex"
                v-model="intent.trainingPhrases[phraseIndex]"
                placeholder="e.g., What are your hours?"
                variant="outlined"
                class="mb-2"
              >
                <template v-slot:append>
                  <v-btn
                    icon="mdi-delete"
                    color="error"
                    @click="removeTrainingPhrase(index, phraseIndex)"
                  ></v-btn>
                </template>
              </v-text-field>
              <v-btn
                color="accent"
                text
                @click="addTrainingPhrase(index)"
                class="mb-4"
              >
                + Add Training Phrase
              </v-btn>
              <v-subheader>Responses</v-subheader>
              <v-text-field
                v-for="(response, responseIndex) in intent.responses"
                :key="responseIndex"
                v-model="intent.responses[responseIndex]"
                placeholder="e.g., We're open from 7 AM to 5 PM."
                variant="outlined"
                class="mb-2"
              >
                <template v-slot:append>
                  <v-btn
                    icon="mdi-delete"
                    color="error"
                    @click="removeResponse(index, responseIndex)"
                  ></v-btn>
                </template>
              </v-text-field>
              <v-btn
                color="accent"
                text
                @click="addResponse(index)"
                class="mb-4"
              >
                + Add Response
              </v-btn>
              <v-btn
                color="error"
                text
                @click="removeIntent(index)"
                class="mt-2"
              >
                Remove Intent
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        <v-btn color="accent" class="mt-4 mr-4" @click="addIntent">
          Add Manual Intent
        </v-btn>
        <v-btn
          color="primary"
          class="mt-4"
          @click="saveIntents"
          :loading="loading"
        >
          Save Manual Intents
        </v-btn>
        <v-alert v-if="message" :type="messageType" class="mt-4">
          {{ message }}
        </v-alert>
      </v-col>
    </v-row>
    <v-row v-if="existingIntents.length">
      <v-col>
        <v-subheader>Existing Intents</v-subheader>
        <v-list>
          <v-list-item
            v-for="intent in existingIntents"
            :key="intent.name"
            :title="intent.displayName"
          >
            <template v-slot:append>
              <v-btn
                icon="mdi-pencil"
                color="accent"
                @click="editIntent(intent)"
              ></v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  data() {
    return {
      jsonFile: null,
      jsonInput: '',
      intents: [{ displayName: '', trainingPhrases: [''], responses: [''] }],
      panel: [],
      message: '',
      messageType: 'success',
      loading: false,
      existingIntents: [],
    };
  },
  methods: {
    async handleFileUpload() {
      if (this.jsonFile) {
        try {
          const text = await this.jsonFile.text();
          this.jsonInput = text;
        } catch (error) {
          this.message = `Error reading file: ${error.message}`;
          this.messageType = 'error';
        }
      }
    },
    async processJson() {
      this.loading = true;
      try {
        const jsonData = JSON.parse(this.jsonInput);
        if (!Array.isArray(jsonData)) {
          throw new Error('JSON must be an array of intents');
        }
        const response = await fetch('/api/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intents: jsonData }),
        });
        const result = await response.json();
        this.message = result.message;
        this.messageType = 'success';
        this.jsonInput = '';
        this.jsonFile = null;
        this.fetchIntents();
      } catch (error) {
        this.message = `Error processing JSON: ${error.message}`;
        this.messageType = 'error';
      } finally {
        this.loading = false;
      }
    },
    addIntent() {
      this.intents.push({
        displayName: '',
        trainingPhrases: [''],
        responses: [''],
      });
      this.panel.push(this.intents.length - 1);
    },
    removeIntent(index) {
      this.intents.splice(index, 1);
      this.panel = this.panel
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    },
    addTrainingPhrase(index) {
      this.intents[index].trainingPhrases.push('');
    },
    removeTrainingPhrase(intentIndex, phraseIndex) {
      this.intents[intentIndex].trainingPhrases.splice(phraseIndex, 1);
    },
    addResponse(index) {
      this.intents[index].responses.push('');
    },
    removeResponse(intentIndex, responseIndex) {
      this.intents[intentIndex].responses.splice(responseIndex, 1);
    },
    async saveIntents() {
      this.loading = true;
      try {
        const response = await fetch('/api/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intents: this.intents }),
        });
        const result = await response.json();
        this.message = result.message;
        this.messageType = 'success';
        this.fetchIntents();
      } catch (error) {
        this.message = `Error: ${error.message}`;
        this.messageType = 'error';
      } finally {
        this.loading = false;
      }
    },
    async fetchIntents() {
      try {
        const response = await fetch('/api/intents');
        const result = await response.json();
        this.existingIntents = result.intents;
      } catch (error) {
        this.message = `Error fetching intents: ${error.message}`;
        this.messageType = 'error';
      }
    },
    editIntent(intent) {
      this.intents.push({
        displayName: intent.displayName,
        trainingPhrases: intent.trainingPhrases.map((p) => p.parts[0].text),
        responses: intent.messages[0].text.text,
      });
      this.panel.push(this.intents.length - 1);
    },
  },
  mounted() {
    this.fetchIntents();
  },
};
</script>

<style scoped>
.v-container {
  background-color: #2d3748;
}
.v-btn--accent {
  color: #f97316 !important;
}
.v-subheader {
  color: #f97316;
}
</style>
