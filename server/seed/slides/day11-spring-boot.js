// "Springboot Backend Engineering.pptx" (Syed Suhail, 27 slides)
// Text carried over slide by slide from the trainer's deck; the slides themselves are the exported
// pictures under public/decks/day11-spring-boot/ (27 slides), so these bullets are talking points.
export default {
  key: "day11-spring-boot",
  title: "Spring Boot – Backend Engineering",
  sections: [
    {
      id: "agenda",
      title: "Today",
      slides: [
        {
          title: "Spring Boot",
          bullets: [
            "Saurav Sanyal, Syed Suhail",
            "A framework for production grade enterprise applications"
          ],
          note: ""
        },
        {
          title: "Agenda",
          bullets: [
            "Understanding Web Apps and Backend Engineering.",
            "Intro To Spring",
            "Core Spring Concepts",
            "Creating a Spring Project",
            "ReST API Development",
            "Hands on Exercises"
          ],
          note: "",
          agenda: [
            {
              id: "mentors",
              title: "Your trainer",
              count: 1,
              first: [
                "Trainer Quick Intro"
              ]
            },
            {
              id: "webapps",
              title: "Web applications & the backend",
              count: 6,
              first: [
                "Introduction to Web Applications",
                "Web Application",
                "Standard Web Application Architecture"
              ]
            },
            {
              id: "spring",
              title: "Spring & Spring Boot",
              count: 3,
              first: [
                "Introduction to Spring & Spring Boot",
                "Spring Framework",
                "What is Spring Boot?"
              ]
            },
            {
              id: "core",
              title: "Core Spring concepts",
              count: 4,
              first: [
                "Core Spring Concepts",
                "Dependency Injection (DI)",
                "Spring Beans"
              ]
            },
            {
              id: "project",
              title: "Creating a Spring Boot project",
              count: 6,
              first: [
                "Creating a Spring Boot Project",
                "Project Creation",
                "Understanding Maven"
              ]
            },
            {
              id: "rest",
              title: "REST API development",
              count: 2,
              first: [
                "ReST API Development",
                "Fundamentals Of ReST"
              ]
            },
            {
              id: "handson",
              title: "Hands-on exercises",
              count: 2,
              first: [
                "Hands on Exercises",
                "Build It Yourself"
              ]
            },
            {
              id: "close",
              title: "Wrap-up",
              count: 1,
              first: [
                "Thank you!"
              ]
            }
          ]
        }
      ]
    },
    {
      id: "mentors",
      title: "Your trainer",
      slides: [
        {
          title: "Trainer Quick Intro",
          bullets: [
            "Syed Ameer Suhail",
            "7.5 Years of experience in Backend Development",
            "Currently working as a Lead Software Engineer - Sales order Domain.",
            "Joined Ferguson in May 2025.",
            "Core Expertise: Java, Spring Boot, Microservices, Cloud (Azure) & Backend Systems.",
            "Saurav Sanyal",
            "Software Engineer with 6+ YoE in building backend and enterprise applications.",
            "Currently working as Lead Software Engineer at Omni#1 team, working on APIs, middleware, integrations, and event-driven systems.",
            "My core expertise includes Java, Spring Boot, Microservices, Cloud, Databases, and Distributed Systems.",
            "Currently expanding into AI Engineering, with hands-on work in RAG, LLMs, Vector Search, and AI-powered applications."
          ],
          note: ""
        }
      ]
    },
    {
      id: "webapps",
      title: "Web applications & the backend",
      slides: [
        {
          title: "Introduction to Web Applications",
          bullets: [
            "What is a Web Application?",
            "Examples of Web Applications",
            "Components/Layers",
            "Where Does the Backend Sit?",
            "Browser → Backend → Database Flow",
            "What Does a Backend Do?",
            "Receive Requests",
            "Business Logic Processing",
            "Database Interaction",
            "API Integration"
          ],
          note: ""
        },
        {
          title: "Web Application",
          bullets: [
            "A Web application is a interactive software application that you can access through a web browser over the internet.",
            "Examples :",
            "Online Banking",
            "E-commerce Application",
            "Food Delivery app",
            "Social media platform",
            "Learning Portal"
          ],
          note: ""
        },
        {
          title: "Standard Web Application Architecture",
          bullets: [
            "Web Application Architecture"
          ],
          note: ""
        },
        {
          title: "Backend In Web Apps",
          bullets: [],
          note: ""
        },
        {
          title: "Sample Request & Response",
          bullets: [
            "Request url: https://api.example.com/products/watches"
          ],
          note: ""
        },
        {
          title: "What Does a Backend Engineer Do?",
          bullets: [
            "A backend engineer builds and maintains the server-side part of an application.",
            "Core responsibilities",
            "Build REST APIs",
            "Implement business logic",
            "Work with databases",
            "Implement authentication & authorization",
            "Validate and process incoming data",
            "Handle errors and exceptions",
            "Integrate with other services",
            "Write unit & integration tests"
          ],
          note: ""
        }
      ]
    },
    {
      id: "spring",
      title: "Spring & Spring Boot",
      slides: [
        {
          title: "Introduction to Spring & Spring Boot",
          bullets: [
            "Why Do We Need Spring Boot?",
            "Challenges before Spring Boot",
            "Benefits of Spring Boot",
            "What is Spring Boot?",
            "Framework Overview",
            "Embedded Servers",
            "Auto Configuration",
            "Starter Projects",
            "What Can We Build Using Spring Boot?",
            "REST APIs"
          ],
          note: ""
        },
        {
          title: "Spring Framework",
          bullets: [
            "The Spring Framework is a popular open-source Java framework used to build enterprise applications, especially backend and web applications.",
            "What does Spring provide",
            "Spring Core — Dependency Injection and IoC (Inversion of Control)",
            "Spring MVC — Web applications and REST APIs",
            "Spring Data — Easier database access",
            "Spring Security — Authentication and authorization",
            "Spring AOP — Cross-cutting functionality such as logging and transactions",
            "Spring Test — Testing support"
          ],
          note: ""
        },
        {
          title: "What is Spring Boot?",
          bullets: [
            "Spring Boot is a tool built on top of Spring that makes using Spring much easier.",
            "Java",
            "↓",
            "Spring",
            "Spring Boot",
            "Java is the programming language.",
            "Spring is a framework that provides lots of infrastructure for Java applications.",
            "Spring Boot makes setting up and using Spring applications much easier."
          ],
          note: ""
        }
      ]
    },
    {
      id: "core",
      title: "Core Spring concepts",
      slides: [
        {
          title: "Core Spring Concepts",
          bullets: [],
          note: ""
        },
        {
          title: "Dependency Injection (DI)",
          bullets: [
            "Benefits of DI",
            "Types of Dependency Injection",
            "Inversion of Control (IoC)",
            "In the Spring Framework, IoC (Inversion of Control) is a design principle where the control of object creation, configuration, and lifecycle management is…",
            "Instead of manually instantiating classes using the new keyword, an external container manages these tasks for you"
          ],
          note: ""
        },
        {
          title: "Spring Beans",
          bullets: [
            "What is a Bean",
            "Bean Lifecycle (High Level)"
          ],
          note: ""
        },
        {
          title: "Important Annotations in SpringBoot",
          bullets: [
            "@SpringBootApplication",
            "@SpringBootConfiguration",
            "@EnableAutoConfiguration",
            "@ComponentScan",
            "@Component",
            "@Autowired",
            "@Service",
            "@Repository",
            "@Configuration",
            "@RestController"
          ],
          note: ""
        }
      ]
    },
    {
      id: "project",
      title: "Creating a Spring Boot project",
      slides: [
        {
          title: "Creating a Spring Boot Project",
          bullets: [],
          note: ""
        },
        {
          title: "Project Creation",
          bullets: [
            "Spring Initializr",
            "Build Tool (Gradle/Maven)",
            "Language",
            "Significance Of Group & Artifact",
            "Packaging",
            "Configuration",
            "Selecting Dependencies",
            "What Are Dependencies?",
            "Who Owns Them?"
          ],
          note: ""
        },
        {
          title: "Understanding Maven",
          bullets: [
            "Build Tool",
            "Dependency Management",
            "mvn clean",
            "mvn compile",
            "mvn package",
            "mvn spring-boot:run",
            "Common Maven Commands"
          ],
          note: ""
        },
        {
          title: "POM.xml",
          bullets: [
            "A POM (Project Object Model) file is an XML file that serves as the fundamental building block of a Maven project. It contains information about the project…",
            "Importance of the POM File",
            "The POM file is pivotal in Maven-based projects for various reasons:",
            "Dependency Management: It defines project dependencies and their versions, ensuring that the required libraries are available during compilation and runtime.",
            "Lifecycle Management: It defines the build lifecycle phases and their associated goals, allowing developers to execute tasks such as compilation, testing,…",
            "Plugin Configuration: It specifies which plugins should be used in the build process and how they should be configured.",
            "Project Metadata",
            "Parent POM",
            "Dependencies",
            "Plugins"
          ],
          note: ""
        },
        {
          title: "Understanding Project Structure & Layer",
          bullets: [
            "Benefits",
            "Separation of Concerns",
            "Maintainability",
            "Testability",
            "Types of Layers",
            "Controller",
            "Service",
            "Repository",
            "Database"
          ],
          note: "Spring Boot Folder Structure (Best Practices) | Coding Shuttle – For Detailed References"
        },
        {
          title: "Configuration Files",
          bullets: [
            "application.properties",
            "application.yml"
          ],
          note: ""
        }
      ]
    },
    {
      id: "rest",
      title: "REST API development",
      slides: [
        {
          title: "ReST API Development",
          bullets: [],
          note: ""
        },
        {
          title: "Fundamentals Of ReST",
          bullets: [
            "What is REST?",
            "Resource Based Design",
            "Stateless Communication",
            "HTTP Methods",
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "Request & Response"
          ],
          note: ""
        }
      ]
    },
    {
      id: "handson",
      title: "Hands-on exercises",
      slides: [
        {
          title: "Hands on Exercises",
          bullets: [],
          note: ""
        },
        {
          title: "Build It Yourself",
          bullets: [
            "DB Integration",
            "Order CRUD API",
            "Customer CRUD API",
            "External API Integration",
            "Validation (Bonus)"
          ],
          note: ""
        }
      ]
    },
    {
      id: "close",
      title: "Wrap-up",
      slides: [
        {
          title: "Thank you!",
          bullets: [
            "FERGUSON.COM"
          ],
          note: ""
        }
      ]
    }
  ]
};
