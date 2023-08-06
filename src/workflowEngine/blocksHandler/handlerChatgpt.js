import { Configuration, OpenAIApi } from 'openai';

export async function chatgpt({ data, id }) {
  const nextBlockId = this.getBlockConnections(id);

  if (data.openaikey === 0) {
    throw new Error('openaikey-empty');
  }

  const configuration = new Configuration({
    apiKey: data.openaikey,
  });
  const openai = new OpenAIApi(configuration);

  const completion = await openai.createChatCompletion({
    model: data.openaimodel,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: data.openaiprompt },
    ],
  });

  const textGpt = completion.data.choices[0].message.content;

  if (data.assignVariable) {
    this.setVariable(data.variableName, textGpt);
  }
  if (data.saveData) {
    this.addDataToColumn(data.dataColumn, textGpt);
  }

  return {
    nextBlockId,
    data: textGpt,
  };
}

export default chatgpt;
