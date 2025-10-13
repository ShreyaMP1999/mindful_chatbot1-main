#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class MentalHealthChatbotTester:
    def __init__(self, base_url="https://wellbeing-ai-7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def log_result(self, test_name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
            self.errors.append(f"{test_name}: {details}")
        
        if details:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request and return response"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}"

            success = response.status_code == expected_status
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                return False, f"Status {response.status_code}: {response.text}"
                
        except requests.exceptions.Timeout:
            return False, "Request timeout (30s)"
        except requests.exceptions.ConnectionError:
            return False, "Connection error - backend may be down"
        except Exception as e:
            return False, f"Request error: {str(e)}"

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.make_request('GET', '')
        if success and isinstance(response, dict) and 'message' in response:
            self.log_result("API Root", True, f"Message: {response['message']}")
            return True
        else:
            self.log_result("API Root", False, str(response))
            return False

    def test_create_session(self):
        """Test session creation"""
        test_data = {"nickname": "TestUser"}
        success, response = self.make_request('POST', 'session', test_data, 200)
        
        if success and isinstance(response, dict) and 'id' in response:
            self.session_id = response['id']
            self.log_result("Create Session", True, f"Session ID: {self.session_id}")
            return True
        else:
            self.log_result("Create Session", False, str(response))
            return False

    def test_get_session(self):
        """Test getting session details"""
        if not self.session_id:
            self.log_result("Get Session", False, "No session ID available")
            return False
            
        success, response = self.make_request('GET', f'session/{self.session_id}')
        
        if success and isinstance(response, dict) and response.get('id') == self.session_id:
            self.log_result("Get Session", True, f"Nickname: {response.get('nickname', 'None')}")
            return True
        else:
            self.log_result("Get Session", False, str(response))
            return False

    def test_chat_normal_message(self):
        """Test normal chat message"""
        if not self.session_id:
            self.log_result("Chat Normal Message", False, "No session ID available")
            return False
            
        test_message = "Hello, I'm feeling a bit anxious today. Can you help me?"
        test_data = {
            "message": test_message,
            "session_id": self.session_id
        }
        
        success, response = self.make_request('POST', 'chat', test_data, 200)
        
        if success and isinstance(response, dict):
            ai_message = response.get('message', '')
            crisis_detected = response.get('crisis_detected', False)
            sentiment = response.get('sentiment', {})
            
            if ai_message and not crisis_detected:
                self.log_result("Chat Normal Message", True, 
                    f"AI Response length: {len(ai_message)}, Sentiment: {sentiment.get('label', 'N/A')}")
                return True
            else:
                self.log_result("Chat Normal Message", False, 
                    f"Missing AI response or unexpected crisis detection: {response}")
                return False
        else:
            self.log_result("Chat Normal Message", False, str(response))
            return False

    def test_crisis_detection(self):
        """Test crisis detection functionality"""
        if not self.session_id:
            self.log_result("Crisis Detection", False, "No session ID available")
            return False
            
        crisis_message = "I want to die and can't go on anymore"
        test_data = {
            "message": crisis_message,
            "session_id": self.session_id
        }
        
        success, response = self.make_request('POST', 'chat', test_data, 200)
        
        if success and isinstance(response, dict):
            crisis_detected = response.get('crisis_detected', False)
            resources = response.get('resources', [])
            ai_message = response.get('message', '')
            
            if crisis_detected and resources and ai_message:
                self.log_result("Crisis Detection", True, 
                    f"Crisis detected: {crisis_detected}, Resources provided: {len(resources)}")
                return True
            else:
                self.log_result("Crisis Detection", False, 
                    f"Crisis not properly detected or handled: {response}")
                return False
        else:
            self.log_result("Crisis Detection", False, str(response))
            return False

    def test_mood_logging(self):
        """Test mood logging"""
        if not self.session_id:
            self.log_result("Mood Logging", False, "No session ID available")
            return False
            
        test_data = {
            "mood_score": 3,
            "note": "Feeling okay today, a bit tired",
            "session_id": self.session_id
        }
        
        success, response = self.make_request('POST', 'mood', test_data, 200)
        
        if success and isinstance(response, dict) and 'id' in response:
            mood_score = response.get('mood_score')
            note = response.get('note')
            self.log_result("Mood Logging", True, f"Mood: {mood_score}, Note: {note}")
            return True
        else:
            self.log_result("Mood Logging", False, str(response))
            return False

    def test_mood_history(self):
        """Test mood history retrieval"""
        if not self.session_id:
            self.log_result("Mood History", False, "No session ID available")
            return False
            
        success, response = self.make_request('GET', f'mood/{self.session_id}/history')
        
        if success and isinstance(response, list):
            self.log_result("Mood History", True, f"Retrieved {len(response)} mood entries")
            return True
        else:
            self.log_result("Mood History", False, str(response))
            return False

    def test_sentiment_trends(self):
        """Test sentiment trends analysis"""
        if not self.session_id:
            self.log_result("Sentiment Trends", False, "No session ID available")
            return False
            
        success, response = self.make_request('GET', f'sentiment/{self.session_id}/trends')
        
        if success and isinstance(response, dict):
            trends = response.get('trends', [])
            summary = response.get('summary', {})
            self.log_result("Sentiment Trends", True, 
                f"Trends: {len(trends)}, Avg sentiment: {summary.get('avg_sentiment', 'N/A')}")
            return True
        else:
            self.log_result("Sentiment Trends", False, str(response))
            return False

    def test_chat_history(self):
        """Test chat history retrieval"""
        if not self.session_id:
            self.log_result("Chat History", False, "No session ID available")
            return False
            
        success, response = self.make_request('GET', f'chat/{self.session_id}/history')
        
        if success and isinstance(response, list):
            self.log_result("Chat History", True, f"Retrieved {len(response)} messages")
            return True
        else:
            self.log_result("Chat History", False, str(response))
            return False

    def test_resources(self):
        """Test resources endpoint"""
        success, response = self.make_request('GET', 'resources')
        
        if success and isinstance(response, dict):
            crisis_resources = response.get('crisis', [])
            general_resources = response.get('general', [])
            coping_strategies = response.get('coping_strategies', [])
            
            self.log_result("Resources", True, 
                f"Crisis: {len(crisis_resources)}, General: {len(general_resources)}, Coping: {len(coping_strategies)}")
            return True
        else:
            self.log_result("Resources", False, str(response))
            return False

    def test_openai_integration(self):
        """Test OpenAI integration with a specific mental health query"""
        if not self.session_id:
            self.log_result("OpenAI Integration", False, "No session ID available")
            return False
            
        # Wait a bit to avoid rate limiting
        time.sleep(2)
        
        test_message = "I've been having trouble sleeping and feeling overwhelmed with work stress. What coping strategies would you recommend?"
        test_data = {
            "message": test_message,
            "session_id": self.session_id
        }
        
        success, response = self.make_request('POST', 'chat', test_data, 200)
        
        if success and isinstance(response, dict):
            ai_message = response.get('message', '')
            
            # Check if response is meaningful (not just error message)
            if (ai_message and 
                len(ai_message) > 50 and 
                ('stress' in ai_message.lower() or 'sleep' in ai_message.lower() or 'coping' in ai_message.lower())):
                self.log_result("OpenAI Integration", True, 
                    f"AI provided relevant response ({len(ai_message)} chars)")
                return True
            else:
                self.log_result("OpenAI Integration", False, 
                    f"AI response seems generic or error-related: {ai_message[:100]}...")
                return False
        else:
            self.log_result("OpenAI Integration", False, str(response))
            return False

    def test_delete_data(self):
        """Test data deletion (run last)"""
        if not self.session_id:
            self.log_result("Delete Data", False, "No session ID available")
            return False
            
        success, response = self.make_request('DELETE', f'session/{self.session_id}/data', expected_status=200)
        
        if success:
            self.log_result("Delete Data", True, "All user data deleted successfully")
            return True
        else:
            self.log_result("Delete Data", False, str(response))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Mental Health Chatbot Backend Tests")
        print(f"🔗 Testing API at: {self.api_url}")
        print("=" * 60)
        
        # Test in logical order
        tests = [
            self.test_api_root,
            self.test_create_session,
            self.test_get_session,
            self.test_resources,
            self.test_chat_normal_message,
            self.test_crisis_detection,
            self.test_openai_integration,
            self.test_mood_logging,
            self.test_mood_history,
            self.test_sentiment_trends,
            self.test_chat_history,
            self.test_delete_data,
        ]
        
        for test in tests:
            try:
                test()
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                self.log_result(test.__name__, False, f"Test exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.errors)}/{self.tests_run}")
        
        if self.errors:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.errors:
                print(f"   • {error}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Backend is functioning well!")
            return 0
        elif success_rate >= 60:
            print("⚠️  Backend has some issues but core functionality works")
            return 1
        else:
            print("🚨 Backend has significant issues")
            return 2

def main():
    tester = MentalHealthChatbotTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())