const OpenAI = require('openai');

class OpenAIService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is required');
        }
        
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        
        this.defaultModel = 'gpt-3.5-turbo';
        this.maxTokens = 150;
        this.temperature = 0.7;
    }
    
    async generateResponse(userMessage, conversationHistory = []) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: '당신은 친근하고 도움이 되는 AI 어시스턴트입니다. 한국어로 답변하며, 간결하고 명확하게 대화하세요.'
                },
                ...conversationHistory,
                {
                    role: 'user',
                    content: userMessage
                }
            ];
            
            const completion = await this.client.chat.completions.create({
                model: this.defaultModel,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
            });
            
            const response = completion.choices[0]?.message?.content;
            
            if (!response) {
                throw new Error('No response received from OpenAI');
            }
            
            return {
                success: true,
                response: response.trim(),
                usage: completion.usage
            };
            
        } catch (error) {
            console.error('OpenAI API Error:', error);
            
            return {
                success: false,
                error: error.message,
                response: '죄송합니다. 현재 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.'
            };
        }
    }
    
    async generateStreamResponse(userMessage, conversationHistory = [], onChunk) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: '당신은 친근하고 도움이 되는 AI 어시스턴트입니다. 한국어로 답변하며, 간결하고 명확하게 대화하세요.'
                },
                ...conversationHistory,
                {
                    role: 'user',
                    content: userMessage
                }
            ];
            
            const stream = await this.client.chat.completions.create({
                model: this.defaultModel,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                stream: true,
            });
            
            let fullResponse = '';
            
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    if (onChunk) {
                        onChunk(content);
                    }
                }
            }
            
            return {
                success: true,
                response: fullResponse.trim()
            };
            
        } catch (error) {
            console.error('OpenAI Stream API Error:', error);
            
            return {
                success: false,
                error: error.message,
                response: '죄송합니다. 현재 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.'
            };
        }
    }
    
    // 대화 히스토리 관리를 위한 헬퍼 메서드
    formatConversationHistory(messages, maxHistory = 10) {
        // 최근 N개의 메시지만 유지
        const recentMessages = messages.slice(-maxHistory);
        
        return recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
}

module.exports = OpenAIService;