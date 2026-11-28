plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "in.ac.dypiu.campuscast.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "in.ac.dypiu.campuscast.tv"
        minSdk = 21
        targetSdk = 34
        versionCode = 6
        versionName = "1.0.5"
    }

    // Release signing comes from the environment (CI secrets or a local keystore.env); without it the build
    // falls back to the debug key so local test builds still work.
    val ksPath = System.getenv("NEXORA_KEYSTORE")
    signingConfigs {
        if (!ksPath.isNullOrBlank()) {
            create("nexora") {
                storeFile = file(ksPath)
                storePassword = System.getenv("NEXORA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("NEXORA_KEY_ALIAS") ?: "nexora"
                keyPassword = System.getenv("NEXORA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (!ksPath.isNullOrBlank()) signingConfigs.getByName("nexora") else signingConfigs.getByName("debug")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    applicationVariants.all {
        outputs.all {
            val output = this as? com.android.build.gradle.internal.api.BaseVariantOutputImpl
            output?.outputFileName = "NEXORA-TV.apk"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
