#!/usr/bin/env node

import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Helper function to get the correct token parameter for different models
const getTokenParameter = (model) => {
  // Models that use max_completion_tokens
  const maxCompletionTokensModels = ['o4-mini', 'o4-mini-preview', 'o4o-mini'];
  
  // Models that use max_tokens
  const maxTokensModels = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
  
  if (maxCompletionTokensModels.includes(model)) {
    return { max_completion_tokens: 100 };
  } else if (maxTokensModels.includes(model)) {
    return { max_tokens: 100 };
  } else {
    // Default to max_tokens for unknown models
    return { max_tokens: 100 };
  }
};

// Helper function to get model-specific parameters
const getModelParameters = (model) => {
  const baseParams = getTokenParameter(model);
  
  // o4-mini models have strict parameter requirements
  if (model === 'o4-mini' || model === 'o4-mini-preview' || model === 'o4o-mini') {
    return {
      ...baseParams,
      // o4-mini only supports default temperature (1), no custom values
      // temperature: 1, // This is the default, so we can omit it
    };
  } else {
    // GPT models support custom temperature
    return {
      ...baseParams,
      temperature: 0.3,
    };
  }
};

async function testModelCompatibility() {
  console.log('🧪 Testing OpenAI Model Compatibility...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const models = ['o4-mini', 'gpt-4', 'gpt-3.5-turbo'];
  
  for (const model of models) {
    console.log(`\n🔍 Testing model: ${model}`);
    console.log('='.repeat(40));
    
    try {
      const modelParams = getModelParameters(model);
      console.log(`📝 Using parameters:`, modelParams);
      
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: "Say 'Hello, this is a test' and nothing else."
          }
        ],
        ...modelParams,
      });

      console.log(`✅ Success! Response: ${completion.choices[0].message.content}`);
      
    } catch (error) {
      console.error(`❌ Error with ${model}:`, {
        status: error.status,
        code: error.code,
        message: error.message
      });
      
      if (error.code === 'unsupported_parameter') {
        console.log(`💡 This model doesn't support the parameter: ${error.param}`);
      } else if (error.message.includes('temperature')) {
        console.log(`💡 This model has temperature restrictions: ${error.message}`);
      }
    }
  }
  
  console.log('\n🎯 Test Summary:');
  console.log('================');
  console.log('✅ Models that work will show successful responses');
  console.log('❌ Models with errors will show what went wrong');
  console.log('💡 Use this to determine which models work with your API key');
  console.log('\n📋 o4-mini Model Notes:');
  console.log('  - Only supports default temperature (1)');
  console.log('  - Uses max_completion_tokens instead of max_tokens');
  console.log('  - Has strict parameter requirements');
}

// Run the test
testModelCompatibility().catch(console.error);
