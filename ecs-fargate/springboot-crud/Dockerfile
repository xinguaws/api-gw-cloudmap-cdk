FROM openjdk:11-jdk-slim
WORKDIR /opt
COPY . .
RUN ./mvnw clean package -DskipTests=true
CMD ["java", "-jar", "/opt/target/springboot2-jpa-crud-h2.jar"]
